import app from '../app';
import { container } from '../ioc.container';
import * as http from 'http';
import * as https from 'https';
import * as socketio from 'socket.io';
import * as fs from 'fs';
import config from '../config';
import 'reflect-metadata';
import { createConnection, ConnectionOptions, getConnection } from 'typeorm';
import { AuthClientType } from '../services/auth.client';
import { TrackServiceType, TrackService, TrackServiceInterface } from '../services/track.service';
import { User } from '../entities/user';
import { Track, TRACK_STATUS_ACTIVE, TRACK_STATUS_AWAITING } from '../entities/track';
import { UserServiceType } from '../services/user.service';
import { TrackQueueInterface, TrackQueueType } from '../queues/track.queue';
import { getUnixtimeMultiplesOfFive } from '../helpers/helpers';

/**
 * Create HTTP server.
 */
const httpServer = http.createServer(app);
const io = socketio(httpServer);
const ormOptions: ConnectionOptions = config.typeOrm as ConnectionOptions;
const messages = {};

createConnection(ormOptions).then(async connection => {
  /**
   * Listen on provided port, on all network interfaces.
   */
  if (config.app.httpServer === 'enabled') {
    httpServer.listen(config.app.port);
  }

  if (config.app.httpsServer === 'enabled') {
    const httpsOptions = {
      key: fs.readFileSync(__dirname + '/../certs/ico-key.pem'),
      cert: fs.readFileSync(__dirname + '/../certs/ico-crt.pem'),
      ca: fs.readFileSync(__dirname + '/../certs/cloudflare.ca'),
      requestCert: true,
      rejectUnauthorized: false
    };

    const httpsServer = https.createServer(httpsOptions, app);
    httpsServer.listen(config.app.httpsPort);
  }

  const authClient: AuthClientInterface = container.get(AuthClientType);
  const trackService: TrackServiceInterface = container.get(TrackServiceType);
  const userService: UserServiceInterface = container.get(UserServiceType);
  const trackQueue: TrackQueueInterface = container.get(TrackQueueType);

  const createBots = async function(botEmails: string[]) {
    const bots = await getConnection().mongoManager.count(User, { email: { '$in': botEmails } });
    if (bots === 0) {
      for (let i = 0; i < botEmails.length; i++) {
        await userService.createActivatedUser({
          agreeTos: true,
          email: botEmails[i],
          name: `Bot_${i}`,
          picture: '',
          password: 'Stub',
          passwordHash: 'Stub'
        });
      }
    }
  };

  trackQueue.setSocket(io);

  // create bots
  const botEmails = ['bot1@secrettech.io', 'bot2@secrettech.io', 'bot3@secrettech.io', 'bot4@secrettech.io', 'bot5@secrettech.io'];
  await createBots(botEmails);

  const sock = io.of('/');

  sock.use(async(socket, next) => {
    let handshake = socket.handshake;
    if (handshake.query.token) {
      const result = await authClient.verifyUserToken(handshake.query.token);
      socket.handshake.query.email = result.login;
      next();
    } else {
      next(new Error('Authentication error'));
    }
  });

  sock.on('connect', async socket => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email}});

    if (!user) {
      io.sockets.in(socket.id).emit('error', {message: 'User not found'});
      socket.disconnect(true);
      return false;
    }

    socket.on('reqProfile', () => {
      io.sockets.in(socket.id).emit('resProfile', {
        picture: user.picture,
        balance: user.ethWallet.balance,
        address: user.ethWallet.address,
        name: user.name
      });
    });

    /**
     * ================== TRACK SECTION ===============
     */
    socket.on('getTracks', async() => {
      let tracks = await getConnection().mongoManager.find(Track, {take: 1000});
      for (let i = 2; i <= 6; i++) {
        if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === i; }).length === 0) {
          tracks.push(await trackService.internalCreateTrack('0.5', i));
        }
      }
      socket.emit('initTracks', {tracks: tracks});
      socket.broadcast.emit('initTracks', {tracks: tracks});
    });

    socket.on('joinTrack', async(joinData: any) => {
      let track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: 'Track not found'});
        return;
      }
      if (track.isActive) {
        io.sockets.in(socket.id).emit('error', {message: 'Track is already active'});
        return;
      }
      track = await trackService.joinToTrack(user, user.mnemonic, joinData.trackId, joinData.fuel, joinData.ship);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: 'Can not join track'});
      }

      trackQueue.addJobWaitNewUsers({
        trackId: track.id.toHexString(),
        numPlayers: track.numPlayers
      });

      socket.join('tracks_' + joinData.trackId, async() => {
        io.sockets.in('tracks_' + joinData.trackId).emit('joinedTrack', joinData);
        if (track.status === TRACK_STATUS_ACTIVE) {
          let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: track.start * 1000, end: track.end * 1000, players: track.players};
          io.sockets.in('tracks_' + joinData.trackId).emit('start', init);
          let currenciesStart = await trackService.getCurrencyRates(track.start);
          const jobProcessTrack = await trackQueue.addJobProcessTrack({
            trackId: track.id.toHexString(),
            currenciesStart: currenciesStart,
            endDate: track.end * 1000 + 3000 // TODO
          });

          trackQueue.addJobProccessTrackFinish({
            trackId: track.id.toHexString(),
            jobProcessTrackId: jobProcessTrack.id
          });
        }
      });

      const tracks = await getConnection().mongoManager.find(Track, {take: 1000});
      socket.emit('initTracks', {tracks: tracks});
      socket.broadcast.emit('initTracks', {tracks: tracks});
    });

    socket.on('loadTrack', async(joinData: any) => {

      const track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: 'Track not found'});
        return;
      }
      if (track.status !== TRACK_STATUS_ACTIVE) {
        io.sockets.in(socket.id).emit('error', {message: 'You can not join inactive track'});
        return;
      }
      socket.join('tracks_' + joinData.trackId, () => {
        let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: track.start * 1000, end: track.end * 1000, players: track.players};
        io.sockets.in(socket.id).emit('start', init);
      });

    });

    socket.on('moveX', (strafeData: Strafe) => {
      io.sockets.in('tracks_' + strafeData.trackId).emit('moveXupdate', strafeData);
    });

    /**
     * ================== CHAT SECTION ===============
     */
    socket.on('joinChat', async(joinData: any) => {

      socket.join('chats_' + joinData.trackId, () => {
        if (!messages[joinData.trackId] || messages[joinData.trackId].length === 0) {
          messages[joinData.trackId] = [];
        }
        io.sockets.in('chats_' + joinData.trackId).emit('joinedChat', messages[joinData.trackId]);
      });

    });

    socket.on('message', message => {

      messages[message.chatId].push({ author: user.name, userId: user.id, ts: Date.now(), message });
      io.sockets.in('chats_' + message.chatId).emit('updateChat', messages[message.chatId]);

    });

  });

}).catch(error => console.log('TypeORM connection error: ', error));
