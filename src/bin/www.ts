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
import { TrackServiceType, TrackServiceInterface } from '../services/track.service';
import { User } from '../entities/user';
import { Track, TRACK_STATUS_ACTIVE } from '../entities/track';
import { UserServiceType } from '../services/user.service';
import { TrackQueueInterface, TrackQueueType } from '../queues/track.queue';
import { Web3ClientInterface, Web3ClientType } from '../services/web3.client';

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
  const web3Client: Web3ClientInterface = container.get(Web3ClientType);

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

  const rootSocket = io.of('/');

  rootSocket.use(async(socket, next) => {
    let handshake = socket.handshake;
    if (handshake.query.token) {
      const result = await authClient.verifyUserToken(handshake.query.token);
      socket.handshake.query.email = result.login;
      next();
    } else {
      next(new Error('Authentication error'));
    }
  });

  rootSocket.on('connect', async subSocket => {
    if (!subSocket.handshake.query.email) {
      io.sockets.in(subSocket.id).emit('error', {message: 'User not found'});
      subSocket.disconnect(true);
      return false;
    }

    const user = await getConnection().mongoManager.findOne(User, {where: {email: subSocket.handshake.query.email}});

    if (!user) {
      io.sockets.in(subSocket.id).emit('error', {message: 'User not found'});
      subSocket.disconnect(true);
      return false;
    }

    subSocket.on('reqProfile', async() => {
      subSocket.emit('resProfile', {
        picture: user.picture,
        balance: await web3Client.getEthBalance(user.ethWallet.address),
        address: user.ethWallet.address,
        name: user.name
      });
    });

    /**
     * ================== TRACK SECTION ===============
     */
    subSocket.on('getTracks', async() => {
      let tracks = await getConnection().mongoManager.find(Track, {take: 1000});
      for (let i = 2; i <= config.game.numTrack; i++) {
        if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === i; }).length === 0) {
          tracks.push({ ...(await trackService.internalCreateTrack(config.game.betAmount, i)), duration: 300000 } as Track);
        }
      }
      subSocket.emit('initTracks', {tracks: tracks});
      subSocket.broadcast.emit('initTracks', {tracks: tracks});
    });

    subSocket.on('joinTrack', async(joinData: any) => {
      let track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(subSocket.id).emit('error', {message: 'Track not found'});
        return;
      }
      if (track.isActive) {
        io.sockets.in(subSocket.id).emit('error', {message: 'Track is already active'});
        return;
      }

      if ((joinData.fuel as Array<number>).reduce((p, c) => p + c) !== 100) {
        io.sockets.in(subSocket.id).emit('error', {message: 'Fuel total is not equal 100%'});
        return;
      }

      track = await trackService.joinToTrack(user, user.mnemonic, joinData.trackId, joinData.fuel, joinData.ship);
      if (!track) {
        io.sockets.in(subSocket.id).emit('error', {message: 'Can not join track'});
      }

      trackQueue.addJobWaitNewUsers({
        trackId: track.id.toHexString(),
        numPlayers: track.numPlayers
      });

      subSocket.join('tracks_' + joinData.trackId, async() => {
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
      subSocket.emit('initTracks', {tracks: tracks});
      subSocket.broadcast.emit('initTracks', {tracks: tracks});
    });

    subSocket.on('loadTrack', async(joinData: any) => {

      const track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(subSocket.id).emit('error', {message: 'Track not found'});
        return;
      }
      if (track.status !== TRACK_STATUS_ACTIVE) {
        io.sockets.in(subSocket.id).emit('error', {message: 'You can not join inactive track'});
        return;
      }
      subSocket.join('tracks_' + joinData.trackId, () => {
        let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: track.start * 1000, end: track.end * 1000, players: track.players};
        io.sockets.in(subSocket.id).emit('start', init);
      });

    });

    subSocket.on('moveX', (strafeData: Strafe) => {
      io.sockets.in('tracks_' + strafeData.trackId).emit('moveXupdate', strafeData);
    });

    /**
     * ================== CHAT SECTION ===============
     */
    subSocket.on('joinChat', async(joinData: any) => {

      subSocket.join('chats_' + joinData.trackId, () => {
        if (!messages[joinData.trackId] || messages[joinData.trackId].length === 0) {
          messages[joinData.trackId] = [];
        }
        io.sockets.in('chats_' + joinData.trackId).emit('joinedChat', messages[joinData.trackId]);
      });

    });

    subSocket.on('message', message => {

      messages[message.chatId].push({ author: user.name, userId: user.id, ts: Date.now(), message });
      io.sockets.in('chats_' + message.chatId).emit('updateChat', messages[message.chatId]);

    });

  });

}).catch(error => console.log('TypeORM connection error: ', error));
