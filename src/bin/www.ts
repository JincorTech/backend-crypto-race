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
import { User } from '../entities/user';

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

chat.use(async(socket, next) => {
  let handshake = socket.handshake;
  await authClient.verifyUserToken(handshake.query.token);
  next();
});

race.use(async(socket, next) => {
  let handshake = socket.handshake;
  await authClient.verifyUserToken(handshake.query.token);
  next();
});

tracks.use(async(socket, next) => {
  let handshake = socket.handshake;
  await authClient.verifyUserToken(handshake.query.token);
  next();
});

chat.on('connect', async socket => {
  const result = await authClient.verifyUserToken(socket.handshake.query.token);
  const user = await getConnection().mongoManager.findOne(User, {where: {email: result.login}});
  socket.on('requestInitData', data => {
    socket.emit('responseInitData', messages);
  });

  socket.on('message', message => {
    messages.push({ author: user.name, userId: user.id, ts: Date.now(), message });
    socket.emit('update', messages);
  });
});

// race
let init: InitRace = {
  raceName: 'to-the-moon',
  start: Date.now(),
  end: Date.now() + 300,
  players: new Array<Player>()
};

setInterval((raceSock, raceData) => {
  const players: Array<Player> = raceData.players;
  const yPositions: YPosition = {playersYPositions: new Array<PlayerYPosition>()};
  players.forEach(player => {
    yPositions.playersYPositions.push({id: player.id, y: Math.random() * 100});
  });
  raceSock.emit('move', yPositions);
}, 3000, race, init);

race.on('connect', async socket => {
  const result = await authClient.verifyUserToken(socket.handshake.query.token);
  const user = await getConnection().mongoManager.findOne(User, {where: {email: result.login}});
  const player: Player = {
    id: user.id.toString(),
    email: user.email, //TODO: replace with some ID
    picture: user.picture,
    name: user.name,
    position: Math.random() > 0.5 ? 1 : 0,
    ship: {type: 'nova'},
    x: Math.random() > 0.5 ? 33.3 : 66.6,
    fuel: [{name: 'btc', value: 10}, {name: 'eth', value: 90}]
  };
  init.players.push(player);
  init.start = Date.now();
  init.end = Date.now() + 300;

  socket.emit('init', init);
  socket.broadcast.emit('player joined', player);

  socket.on('strafe', (strafeData: Strafe) => {
    socket.broadcast.emit('strafe', strafeData);
  });
});

tracks.on('connect', async socket => {
  const result = await authClient.verifyUserToken(socket.handshake.query.token);
  const user = await getConnection().mongoManager.findOne(User, {where: {email: result.login}});



});
