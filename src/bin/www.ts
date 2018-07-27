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
import {Track, TRACK_STATUS_ACTIVE, TRACK_STATUS_AWAITING} from '../entities/track';
import { ancestorWhere } from 'tslint';
// import { jwt_decode } from 'jwt-decode';

/**
 * Create HTTP server.
 */
const httpServer = http.createServer(app);
const io = socketio(httpServer);
const ormOptions: ConnectionOptions = config.typeOrm as ConnectionOptions;

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

  const sock = io.of('/');

  sock.use(async(socket, next) => {
    let handshake = socket.handshake;
    const result = await authClient.verifyUserToken(handshake.query.token);
    socket.handshake.query.email = result.login;
    next();
  });


  sock.on('connect', async socket => {
    const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email}});


    /**
     * ================== TRACK SECTION ===============
     */
    socket.on('getTracks', async () => {
      let tracks = await getConnection().mongoManager.find(Track, {take: 1000});
      if (tracks.filter((track) => { return track.status === 'awaiting'; }).length < 2) {
        tracks.push(await trackService.internalCreateTrack('1'));
        tracks.push(await trackService.internalCreateTrack('0'));
      }
      socket.emit('initTracks', {tracks: tracks});
      socket.broadcast.emit('initTracks', {tracks: tracks});
    });

    socket.on('joinTrack', async (joinData: any) => {
      let track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: "Track not found"});
        return;
      }
      if (track.status !== TRACK_STATUS_AWAITING) {
        io.sockets.in(socket.id).emit('error', {message: "Track is already active"});
        return;
      }
      track = await trackService.joinToTrack(user, user.mnemonic, joinData.trackId, joinData.fuel);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: "Can not join  track"});
      }
      socket.join('tracks_' + joinData.trackId, () => {
        io.sockets.in('tracks_' + joinData.trackId).emit('joinedTrack', joinData);
        if (track.status === TRACK_STATUS_ACTIVE) {
          let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: Date.now(), end: Date.now() + 300, players: track.players};
          io.sockets.in('tracks_' + joinData.trackId).emit('start', init);


          setTimeout(() => {
            const players = [
              {
                id: track.players[0].id.toString(),
                position: 0,
                name: track.players[0].name,
                score: 500,
                prize: 0.1
              },
              {
                id: track.players[1].name,
                position: 1,
                name: 'Andrey',
                score: 300,
                prize: 0
              }
            ];
            io.sockets.in('tracks_' + joinData.trackId).emit('gameover', players);
          }, 30000);

          setTimeout(async () => {
            const stats = await trackService.getStats(track.id.toString());
            console.log("stats: ", stats);
            const playerPositions = stats.map((stat, index) => {
              return {
                id: stat.player.id.toString(),
                position: index
              };
            });
            console.log("Player positions: ", playerPositions);
            io.sockets.in('tracks_' + joinData.trackId).emit('positionUpdate', playerPositions);
          }, 8000);
        }
      });

      const tracks = await getConnection().mongoManager.find(Track, {take: 1000});
      socket.emit('initTracks',{tracks: tracks});
      socket.broadcast.emit('initTracks',{tracks: tracks});
    });

    socket.on('loadTrack', async (joinData: any) => {
      const track = await trackService.getTrackById(joinData.trackId);
      if (!track) {
        io.sockets.in(socket.id).emit('error', {message: "Track not found"});
        return;
      }
      if (track.status !== TRACK_STATUS_ACTIVE) {
        io.sockets.in(socket.id).emit('error', {message: "You can not join inactive track"});
        return;
      }
      socket.join('tracks_' + joinData.trackId, () => {
        let init: InitRace = { id: track.id.toString(), raceName: track.id.toHexString(), start: track.start, end: track.end, players: track.players};
        io.sockets.in(socket.id).emit('start', init);
      });
    });

    socket.on('moveX', (strafeData: Strafe) => {
      io.sockets.in('tracks_' + strafeData.trackId).emit('moveXupdate', strafeData);
    });


    /**
     * ================== CHAT SECTION ===============
     */
    socket.on('joinChat', async (joinData: any) => {
      socket.join('chats_' + joinData.trackId, () => {
        if(!messages[joinData.trackId] || messages[joinData.trackId].length === 0) {
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
