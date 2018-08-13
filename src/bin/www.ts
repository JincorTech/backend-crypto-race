import app from '../app';
import { container } from '../ioc.container';
import * as http from 'http';
import * as https from 'https';
import * as socketio from 'socket.io';
import * as fs from 'fs';
import config from '../config';
import 'reflect-metadata';
import { createConnection, ConnectionOptions, getConnection, getMongoManager, ObjectID } from 'typeorm';
import { AuthClientType } from '../services/auth.client';
import { TrackServiceType, TrackService, TrackServiceInterface } from '../services/track.service';
import { User } from '../entities/user';
import { Track, TRACK_STATUS_ACTIVE, TRACK_STATUS_AWAITING, TRACK_STATUS_FINISHED } from '../entities/track';
import { UserServiceType } from '../services/user.service';
// import { jwt_decode } from 'jwt-decode';

/**
 * Create HTTP server.
 */
const httpServer = http.createServer(app);
const io = socketio(httpServer);
const ormOptions: ConnectionOptions = config.typeOrm as ConnectionOptions;
const timerMap = {};

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

  const messages = {};
  const authClient: AuthClientInterface = container.get(AuthClientType);
  const trackService: TrackServiceInterface = container.get(TrackServiceType);
  const userService: UserServiceInterface = container.get(UserServiceType);

  setInterval(async() => {
    getConnection().mongoManager.find(Track, {where: {
      status: TRACK_STATUS_ACTIVE,
      end: {'$lt': Math.floor(Date.now() / 1000)}
    }}).then(async(activeTracks) => {
      for (let i = 0; i < activeTracks.length; i++) {
        let trackId = activeTracks[i].id.toHexString();
        let stats = await trackService.getStats(trackId);
        for (let i = 0; i < stats.length; i++) {
          const name = (await getConnection().mongoManager.getRepository(User).findOneById(stats[i].player)).name;
          stats[i] = {
            id: stats[i].player.toString(),
            position: i,
            name,
            score: stats[i].score,
            prize: i === 0 ? 0.1 : 0
          };
        }
        await trackService.finishTrack(activeTracks[i], stats);
        io.sockets.in('tracks_' + trackId).emit('gameover', stats);
        clearTimeout(timerMap[trackId]);
        delete timerMap[trackId];
      }
    });
  }, 5000);

  setInterval(async() => {
    const awaitingTracks = await getConnection().mongoManager.find(Track, {where: {
      status: TRACK_STATUS_AWAITING,
      '$and': [
        {latestActivity: {'$ne': 0}},
        {latestActivity: {'$lt': (Date.now() - 6000)}}
      ]
    }});

    for (let i = 0; i < awaitingTracks.length; i++) {
      await addBots(trackService, botEmails, awaitingTracks[i].id.toHexString(), awaitingTracks[i].numPlayers, io);
    }
  }, 5000);

  // create bots
  const botEmails = ['bot1@secrettech.io', 'bot2@secrettech.io', 'bot3@secrettech.io', 'bot4@secrettech.io', 'bot5@secrettech.io'];
  const bots = await getConnection().mongoManager.count(User, {email: {'$in': botEmails}});
  if (bots === 0) {
    for (let i = 0; i < botEmails.length; i++) {
      await userService.createActivatedUser({
        agreeTos: true,
        email: botEmails[i],
        name: `Bot_${i}`,
        picture: '', // TODO: set picture
        password: 'Stub',
        passwordHash: 'Stub'
      });
    }
  }

  const sock = io.of('/');

  sock.use(async(socket, next) => {
    let handshake = socket.handshake;
    const result = await authClient.verifyUserToken(handshake.query.token);
    socket.handshake.query.email = result.login;
    next();
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
      if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === 2; }).length === 0) {
        tracks.push(await trackService.internalCreateTrack('0', 2));
      }
      if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === 3; }).length === 0) {
        tracks.push(await trackService.internalCreateTrack('0', 3));
      }
      if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === 4; }).length === 0) {
        tracks.push(await trackService.internalCreateTrack('0', 4));
      }
      if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === 5; }).length === 0) {
        tracks.push(await trackService.internalCreateTrack('0', 5));
      }
      if (tracks.filter((track) => { return track.status === 'awaiting' && track.maxPlayers === 6; }).length === 0) {
        tracks.push(await trackService.internalCreateTrack('0', 6));
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
      if (track.status !== TRACK_STATUS_AWAITING) {
        io.sockets.in(socket.id).emit('error', {message: 'Track is already active'});
        return;
      }
      track = await trackService.joinToTrack(user, user.mnemonic, joinData.trackId, joinData.fuel, joinData.ship);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: 'Can not join track'});
      }

      socket.join('tracks_' + joinData.trackId, async() => {
        io.sockets.in('tracks_' + joinData.trackId).emit('joinedTrack', joinData);
        if (track.status === TRACK_STATUS_ACTIVE) {
          let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: track.start * 1000, end: track.end * 1000, players: track.players};
          io.sockets.in('tracks_' + joinData.trackId).emit('start', init);
          let currenciesStart = await trackService.getCurrencyRates(track.start);
          let timer = setInterval(async() => {
            let now = Math.floor(Date.now() / 1000);
            now = now % 5 === 0 ? now : now + (5 - (now % 5));
            let stats = await trackService.getStats(track.id.toString(), now);
            let currencies = await trackService.getCurrencyRates(now);
            const playerPositions = stats.map((stat, index) => {
              return {
                id: stat.player.toString(),
                position: index,
                score: stat.score,
                currencies: currencies,
                currenciesStart: currenciesStart
              };
            });

            console.log(playerPositions);
            io.sockets.in('tracks_' + joinData.trackId).emit('positionUpdate', playerPositions);
            if (track.end <= now) {
              for (let i = 0; i < stats.length; i++) {
                const name = (await getConnection().mongoManager.getRepository(User).findOneById(stats[i].player)).name;
                stats[i] = {
                  id: stats[i].player.toString(),
                  position: i,
                  name,
                  score: stats[i].score,
                  prize: i === 0 ? 0.1 : 0
                };
              }
              await trackService.finishTrack(track, stats);
              io.sockets.in('tracks_' + joinData.trackId).emit('gameover', stats);
              clearInterval(timer);
            }
          }, 5000);
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

async function addBots(trackService: TrackServiceInterface, botEmails, trackId, numPlayers, socket) {
  const actualTrack = await trackService.getTrackById(trackId);
  for (let i = 0; i <= actualTrack.maxPlayers - actualTrack.numPlayers; i++) {
    let bot = await getConnection().mongoManager.findOne(User, { where: { email: botEmails[i] } });
    let botTrack = await trackService.joinToTrack(bot, bot.mnemonic, trackId, [10, 20, 30, 40, 0], Math.floor(Math.random() * 4));

    io.sockets.in('tracks_' + trackId).emit('joinedTrack', {
      trackId: trackId,
      fuel: (await trackService.getPortfolio(bot, botTrack.id.toHexString())).assets,
      ship: 2
    });

    if (actualTrack.maxPlayers === actualTrack.numPlayers + i + 1) {
      if (botTrack.status === TRACK_STATUS_ACTIVE) {
        let init: InitRace = { id: botTrack.id.toString(), raceName: trackId, start: botTrack.start * 1000, end: botTrack.end * 1000, players: botTrack.players };
        io.sockets.in('tracks_' + trackId).emit('start', init);
        let currenciesStart = await trackService.getCurrencyRates(botTrack.start);

        timerMap[trackId] = setTimeout(async function run() {
          await processTrack(botTrack, currenciesStart);
          setTimeout(run, 5000);
        }, 5000);
      }
    }

    const tracks = await getConnection().mongoManager.find(Track, { take: 1000 });
    io.emit('initTracks', { tracks: tracks });
  }

  async function processTrack(botTrack: Track, currenciesStart: any) {
    let now = Math.floor(Date.now() / 1000);
    now = now % 5 === 0 ? now : now + (5 - (now % 5));
    let stats = await trackService.getStats(botTrack.id.toString(), now);
    let currencies = await trackService.getCurrencyRates(now);
    const playerPositions = stats.map((stat, index) => {
      return {
        id: stat.player.toString(),
        position: index,
        score: stat.score,
        currencies: currencies,
        currenciesStart: currenciesStart
      };
    });
    io.sockets.in('tracks_' + trackId).emit('positionUpdate', playerPositions);
  }
}
