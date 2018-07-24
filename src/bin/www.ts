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


setInterval((raceSock, raceData) => {
  const players: Array<Player> = raceData.players;
  const yPositions: YPosition = {playersYPositions: new Array<PlayerYPosition>()};
  players.forEach(player => {
    yPositions.playersYPositions.push({id: player.id, y: Math.random() * 100});
  });
  raceSock.emit('move', yPositions);
}, 3000, race, init);

race.on('connect', async socket => {
  const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email}});
  const track = await getConnection().mongoManager.findOne(Track, {
    where: {
      ['players.' + user.id.toString()]: {
        '$exists': true
      }
    }
  });
  if (!track) {
    socket.disconnect();
  }
  console.log("Found track!", track);
  let init: InitRace = {
    raceName: track.name,
    start: Date.now(),
    end: Date.now() + 300,
    players: new Array<Player>()
  };
  init.start = Date.now();
  init.end = Date.now() + 300;
  const isExist = (players: Array<Player>, newPlayer: Player) => {
    const rdc = (acc, player) => {
      if (player.email === newPlayer.email) return true;
      return acc;
    };

    return players.reduce(rdc, false);
  };

  if (!isExist(init.players, player)) {
    socket.emit('joined', player);
    init.players.push(player);
  }

  setInterval(function() {
      init.players = init.players.map(function(player: Player) {
        player.position = player.position === 1 ? 0 : 1;
        return player;
      });
      socket.emit('positionUpdate', init.players);
      socket.broadcast.emit('positionUpdate', init.players);
  }, 40000);

  socket.emit('init', init);
  socket.on('moveX', (strafeData: Strafe) => {
    socket.emit('moveXupdate', strafeData);
    socket.broadcast.emit('moveXupdate', strafeData);
  });

});

tracks.on('connect', async socket => {
  const user = await getConnection().mongoManager.findOne(User, {where: {email: socket.handshake.query.email }});
  let tracks = await getConnection().mongoManager.find(Track, {take: 1000});
  if (tracks.filter((track) => {return track.status === 'awaiting'}).length < 2) {
    tracks.push(await gameClient.createTrackFromBackend('ToTheMoon', '0.1'));
    tracks.push(await gameClient.createTrackFromBackend('ToTheMoon', '0'));
  }
  socket.emit('init', {tracks: tracks});
  socket.broadcast.emit('init', {tracks: tracks});
  socket.on('joinTrack', async (joinData: any) =>  {
    const track = await gameClient.joinToTrack(user, user.mnemonic, joinData.trackId);
    tracks = await getConnection().mongoManager.find(Track, {take: 1000});
    socket.emit('init',{tracks: tracks});
    socket.broadcast.emit('init',{tracks: tracks});
      if (track.numPlayers === track.maxPlayers) {
        socket.emit('start', { trackId: track.id.toString() });
        socket.broadcast.emit('start', { trackId: track.id.toString() });
      }
  });

});
