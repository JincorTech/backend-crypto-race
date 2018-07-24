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
import { GameServiceType } from '../services/game.service';
// import {TrackServiceType, TrackServiceInterface} from '../services/track.service';
import { User } from '../entities/user';
import { Track } from '../entities/track';
import {ancestorWhere} from "tslint";
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
}).catch(error => console.log('TypeORM connection error: ', error));

const chat = io.of('/chat');
const race = io.of('/race');
const tracks = io.of('/tracks');

const messages = [];
const authClient: AuthClientInterface = container.get(AuthClientType);
const gameClient: GameServiceInterface = container.get(GameServiceType);
// const trackService: TrackServiceInterface = container.get(TrackServiceType);

chat.use(async(socket, next) => {
  let handshake = socket.handshake;
  const result = await authClient.verifyUserToken(handshake.query.token);
  socket.handshake.query.email = result.login;
  next();
});

race.use(async(socket, next) => {
  let handshake = socket.handshake;
  const result = await authClient.verifyUserToken(handshake.query.token);
  socket.handshake.query.email = result.login;
  next();
});

tracks.use(async(socket, next) => {
  let handshake = socket.handshake;
  const result = await authClient.verifyUserToken(handshake.query.token);
  socket.handshake.query.email = result.login;
  next();
});

chat.on('connect', async socket => {
  const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email}});
  socket.on('requestInitData', data => {
    socket.emit('responseInitData', messages);
  });

  socket.on('message', message => {
    messages.push({ author: user.name, userId: user.id, ts: Date.now(), message });
    socket.emit('update', messages);
    socket.broadcast.emit('update', messages);
  });
});


race.on('connect', async socket => {
  const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email}});
  const track = await getConnection().mongoManager.findOne(Track, {
    where: {
      users: {
        '$in': [user.id.toString()]
      }
    }
  });
  if (!track) {
    socket.disconnect();
  }
  socket.join(track.id.toString());
  let init: InitRace = { raceName: track.name, start: Date.now(), end: Date.now() + 300, players: track.players};

  socket.to(track.id.toString()).emit('init', init);
  socket.on('moveX', (strafeData: Strafe) => {
    socket.to(track.id.toString()).emit('moveXupdate', strafeData);
    socket.to(track.id.toString()).broadcast.emit('moveXupdate', strafeData);
  });

});

tracks.on('connect', async socket => {
  const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email }});
  let tracks = await getConnection().mongoManager.find(Track, {take: 1000});
  if (tracks.filter((track) => {return track.status === 'awaiting'}).length < 2) {
    tracks.push(await gameClient.createTrackFromBackend('To the moon', '0.1'));
    tracks.push(await gameClient.createTrackFromBackend('To the moon free', '0'));
  }
  socket.emit('init', {tracks: tracks});
  socket.broadcast.emit('init', {tracks: tracks});

  socket.on('joinTrack', async (joinData: any) =>  {
    const track = await gameClient.joinToTrack(user, user.mnemonic, joinData.trackId);
    if (track) {
      socket.join('tracks' + joinData.trackId, function () {
        socket.in('tracks' + joinData.trackId).emit('joined', joinData);
        if (track.numPlayers === track.maxPlayers) {
          socket.in('tracks' + joinData.trackId).emit('start', { trackId: joinData.trackId });
        }
      });
    }
    tracks = await getConnection().mongoManager.find(Track, {take: 1000});
    socket.emit('init',{tracks: tracks});
    socket.broadcast.emit('init',{tracks: tracks});
  });

});
