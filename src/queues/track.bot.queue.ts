import * as Bull from 'bull';
import config from '../config';
import { injectable, inject } from 'inversify';
import { ObjectID } from 'mongodb';
import { getConnection } from 'typeorm';
import { Track, TRACK_STATUS_ACTIVE } from '../entities/track';
import { User } from '../entities/user';
import { TrackServiceType, TrackServiceInterface } from '../services/track.service';
import { Logger } from '../logger';
import { getUnixtimeMultiplesOfFive } from '../helpers/helpers';

const botEmails = ['bot1@secrettech.io', 'bot2@secrettech.io', 'bot3@secrettech.io', 'bot4@secrettech.io', 'bot5@secrettech.io'];

export interface TrackBotQueueInterface {
  addJobWaitNewUsers(data: any);
  setSocket(io: any);
}

@injectable()
export class TrackBotQueue implements TrackBotQueueInterface {
  private queueWrapper: Bull.Queue;
  private queueProcessTrackWrapper: Bull.Queue;
  private queueProcessTrackFinishWrapper: Bull.Queue;
  private bots: User[] = [];
  private logger = Logger.getInstance('TRACK_BOT_QUEUE');
  private io: any;

  constructor(@inject(TrackServiceType) private trackService: TrackServiceInterface) {
    this.queueWrapper = new Bull('track_bot_queue', config.redis.url);
    this.queueProcessTrackWrapper = new Bull('process_track_queue', config.redis.url);
    this.queueProcessTrackFinishWrapper = new Bull('process_track_finish_queue', config.redis.url);

    this.queueWrapper.process((job) => {
      return this.processAddBot(job);
    });

    this.queueProcessTrackWrapper.process((job) => {
      return this.processTrack(job);
    });

    this.queueProcessTrackFinishWrapper.process((job) => {
      return this.processTrackFinish(job);
    });

    this.logger.verbose('TrackBot job worker started');
  }

  addJobWaitNewUsers(data: any) {
    this.queueWrapper.add(data, {delay: 5000});
    this.logger.debug(`Added new job [wait for new users]: trackId: ${data.trackId}`);
  }

  private async addJobProcessTrack(data: any): Promise<Bull.Job> {
    this.logger.debug(`Adding new job [process track]: trackId: ${data.trackId}`);
    return this.queueProcessTrackWrapper.add(data, {repeat: {
      cron: '*/5 * * * * *',
      endDate: data.endDate
    }});
  }

  private async addJobProccessTrackFinish(data: any): Promise<Bull.Job> {
    this.logger.debug(`Adding new job [process track finish]: trackId ${data.trackId}`);
    return this.queueProcessTrackFinishWrapper.add(data, {delay: 1000 * 60 * 5 + 5000});
  }

  setSocket(io: any) {
    this.io = io;
  }

  private async processAddBot(job: Bull.Job): Promise<boolean> {
    this.logger.debug(`Before procees: ${job.data.trackId}`);
    const track = await getConnection().mongoManager.findOneById(Track, new ObjectID(job.data.trackId));
    if (track.numPlayers === job.data.numPlayers) {
      await this.addBots(
        job.data.trackId
      );
    }
    return true;
  }

  private async processTrack(job: Bull.Job): Promise<boolean> {
    this.logger.debug(`Before process track: ${job.data.trackId}`);
    const now = getUnixtimeMultiplesOfFive();
    let stats = await this.trackService.getStats(job.data.trackId, now - 5);
    let currencies = await this.trackService.getCurrencyRates(now - 5);
    const playerPositions = stats.map((stat, index) => {
      return {
        id: stat.player.toString(),
        position: index,
        score: stat.score,
        currencies: currencies,
        currenciesStart: job.data.currenciesStart
      };
    });
    this.io.sockets.in('tracks_' + job.data.trackId).emit('positionUpdate', playerPositions);
    this.logger.debug(`End process track: ${job.data.trackId}`);
    return true;
  }

  private async getBots(): Promise<User[]> {
    if (this.bots.length === 0) {
      this.bots = await getConnection().mongoManager.find(User, {where: {email: {'$in': botEmails}}});
    }
    return this.bots;
  }

  private async addBots(trackId) {
    this.logger.debug('Adding bots');
    const track = await this.trackService.getTrackById(trackId);
    const neededBots = track.maxPlayers - track.numPlayers;
    const bots = await this.getBots();

    for (let i = 0; i < neededBots; i++) {
      let botTrack = await this.trackService.joinToTrack(bots[i], bots[i].mnemonic, trackId, [10, 20, 30, 40, 0].sort((a,b) => Math.random() - 0.5), Math.floor(Math.random() * 4));

      this.io.sockets.in('tracks_' + trackId).emit('joinedTrack', {
        trackId: trackId,
        fuel: (await this.trackService.getPortfolio(bots[i], botTrack.id.toHexString())).assets,
        ship: 2
      });

      if (botTrack.status === TRACK_STATUS_ACTIVE) {
        let init: InitRace = { id: botTrack.id.toString(), raceName: trackId, start: botTrack.start * 1000, end: botTrack.end * 1000, players: botTrack.players };
        this.io.sockets.in('tracks_' + trackId).emit('start', init);
        let currenciesStart = await this.trackService.getCurrencyRates(botTrack.start - 5);

        const jobProcessTrack = await this.addJobProcessTrack({
          trackId: botTrack.id.toHexString(),
          currenciesStart: currenciesStart,
          endDate: botTrack.end * 1000 + 3000 // TODO
        });

        this.addJobProccessTrackFinish({
          trackId: botTrack.id.toHexString(),
          jobProcessTrackId: jobProcessTrack.id
        });
      }

      const tracks = await getConnection().mongoManager.find(Track, { take: 1000 });
      this.io.emit('initTracks', { tracks: tracks });
    }
  }

  private async processTrackFinish(job: Bull.Job): Promise<boolean> {
    const jobProcessTrack = await this.queueProcessTrackWrapper.getJob(job.data.jobProcessTrackId);
    jobProcessTrack.remove();

    const trackId = job.data.trackId;
    const track = await this.trackService.getTrackById(trackId);
    let stats = await this.trackService.getStats(trackId);
    for (let i = 0; i < stats.length; i++) {
      const name = (await getConnection().mongoManager.getRepository(User).findOneById(stats[i].player)).name;
      stats[i] = {
        id: stats[i].player.toString(),
        position: i,
        name,
        score: stats[i].score,
        result: stats[i].score > 100 ? stats[i].score - 100 : -(100 - stats[i].score),
        prize: i === 0 ? 0.1 : 0,
        ship: track.getTypeShipByUser(stats[i].player.toString())
      };
    }
    await this.trackService.finishTrack(track, stats);
    this.io.sockets.in('tracks_' + trackId).emit('gameover', stats);

    return true;
  }
}

const TrackBotQueueType = Symbol('TrackBotQueueInterface');
export { TrackBotQueueType };
