import { injectable, inject } from 'inversify';
import { User } from '../entities/user';
import { Portfolio } from '../entities/portfolio';
import {
  Track, TRACK_TYPE_BACKEND, TRACK_STATUS_AWAITING, TRACK_TYPE_USER, TRACK_STATUS_ACTIVE,
  TRACK_STATUS_FINISHED
} from '../entities/track';
import { Web3ClientInterface, Web3ClientType } from './web3.client';
import { getConnection, MongoRepository } from 'typeorm';
import { ObjectID } from 'mongodb';
import { Currency } from '../entities/currency';
import * as Redis from 'redis';
import config from '../config';
import { promisify } from 'util';

const client = Redis.createClient(config.redis.url);
const redisGetAsync = promisify(client.get).bind(client);

export interface TrackServiceInterface {
  joinToTrack(user: User, mnemonic: string, id: string, fuel: Array<any>, ship: number): Promise<Track>;
  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Array<Asset>
  ): Promise<any>;
  getPortfolio(user: User, id: string): Promise<Portfolio>;
  getAllTracks(): Promise<Array<Track>>;
  getTrackById(name: string): Promise<Track>;
  getTracksByUser(user: User): Promise<Array<Track>>;
  activeTracks(): Promise<Array<Track>>;
  awaitingTracks(): Promise<Array<Track>>;
  createTrack(user: User, mnemonic: string, betAmount: string): Promise<Track>;
  internalCreateTrack(betAmount: string, players: number): Promise<Track>;
  getPlayers(id: string): Promise<Array<string>>;
  startTrack(id: string, start: number): Promise<boolean>;
  isReady(id: string): Promise<boolean>;
  getStats(id: string, end?: number): Promise<any>;
  getWinners(id: string): Promise<any>;
  finishTrack(track: Track, winners: any);
  getRewards(user: User, mnemonic: string, id: string): Promise<any>;
  getCurrencyRates(timestamp: number): Promise<any>;
}

@injectable()
export class TrackService implements TrackServiceInterface {
  private trackRepo: MongoRepository<Track>;
  private userRepo: MongoRepository<User>;

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {
    this.trackRepo = getConnection().mongoManager.getMongoRepository(Track);
    this.userRepo = getConnection().mongoManager.getMongoRepository(User);
  }

  async createTrack(user: User, mnemonic: string, betAmount: string): Promise<Track> {
    const track = Track.createTrack(betAmount, TRACK_TYPE_USER);
    track.creator = user.id;
    await this.trackRepo.save(track);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.createTrackFromUserAccount(account, track.id.toHexString(), betAmount);

    return track;
  }

  public async finishTrack(track: Track, winners) {
    track.status = TRACK_STATUS_FINISHED;
    track.winners = winners;

    setTimeout(async() => {
      const rates = await this.getCurrencyRates(track.end);
      const names = Object.keys(rates);
      const amounts = Object.keys(rates).map(key => rates[key]);
      this.web3Client.setRates(track.end, names, amounts);
    }, 6000);

    return await this.trackRepo.save(track);
  }

  async internalCreateTrack(betAmount: string, maxPlayers: number): Promise<Track> {
    const track = new Track();
    track.betAmount = betAmount;
    track.maxPlayers = maxPlayers;
    track.numPlayers = 0;
    track.duration = 300;
    track.type = TRACK_TYPE_BACKEND;
    track.timestamp = Math.floor(Date.now() / 1000);
    track.status = TRACK_STATUS_AWAITING;
    await getConnection().mongoManager.getRepository(Track).save(track);

    await this.web3Client.createTrackFromBackend(track.id.toHexString(), betAmount, maxPlayers, 300);

    return track;
  }

  async activeTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {status: TRACK_STATUS_ACTIVE}});
  }

  async awaitingTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {status: TRACK_STATUS_AWAITING}});
  }

  async joinToTrack(user: User, mnemonic: string, id: string, fuel: Array<any>, ship: number): Promise<Track> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    const track = await this.getTrackById(id);
    const assets = this.assetsFromFuel(fuel);
    await this.addPlayerToTrack(track, user, assets, ship);
    await this.setPortfolio(user, mnemonic, track.id.toString(), assets);

    this.web3Client.joinToTrack(account, id, assets).then(r => {
      if (track.numPlayers === track.maxPlayers) {
        this.startTrack(track.id.toHexString(), track.start);
        setTimeout(async() => {
          const rates = await this.getCurrencyRates(track.start);
          const names = Object.keys(rates);
          const amounts = Object.keys(rates).map(key => rates[key]);
          this.web3Client.setRates(track.start, names, amounts);
        }, 6000);
      }
    });
    return track;
  }

  async setPortfolio(
    user: User,
    mnemonic: string,
    id: string,
    portfolio: Asset[]
  ): Promise<any> {
    const portfolioEntity = new Portfolio();
    portfolioEntity.assets = portfolio;
    portfolioEntity.track = new ObjectID(id);
    portfolioEntity.user = user.id;
    const track = await this.getTrackById(id);
    if (!track) {
      return false;
    }
    const exists = await getConnection().mongoManager.find(Portfolio, {
      where: {
        track: track.id,
        user: user.id
      }
    });
    if (exists.length > 0) return false;
    await getConnection().mongoManager.save(Portfolio, portfolioEntity);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.setPortfolio(account, id, portfolio);

    return portfolioEntity;
  }

  async getPortfolio(user: User, id: string): Promise<Portfolio> {
    const track = await this.getTrackById(id);
    return getConnection().mongoManager.findOne(Portfolio, {where: {track: track.id, user: user.id}});
  }

  async getPortfolios(id: string): Promise<Array<Portfolio>> {
    return getConnection().mongoManager.find(Portfolio, {where: {track: new ObjectID(id)}});
  }

  async getAllTracks(): Promise<Track[]> {
    return this.trackRepo.find();
  }

  async getTrackById(id: string): Promise<Track> {
    return this.trackRepo.findOneById(new ObjectID(id));
  }

  async getTracksByUser(user: User): Promise<Track[]> {
    return this.trackRepo.find({where: {creator: user.id}});
  }

  async getPlayers(id: string): Promise<string[]> {
    const track = await this.getTrackById(id);
    return track.users;
  }

  async startTrack(id: string, start: number): Promise<boolean> {
    if (!(await this.isReady(id))) {
      throw new Error(`Track #${id} is not ready`);
    }

    const track = await this.getTrackById(id);
    track.status = TRACK_STATUS_ACTIVE;
    track.start = start;
    track.end = track.start + track.duration;

    await this.trackRepo.save(track);

    this.web3Client.startTrack(track.id.toHexString(), track.start);

    return true;
  }

  async isReady(id: string): Promise<boolean> {
    const track = await this.getTrackById(id);
    if ((await getConnection().mongoManager.count(Portfolio, {track: new ObjectID(id)})) === track.maxPlayers) {
      return true;
    }
    return false;
  }

  async getStats(id: string, end?: number): Promise<any> {
    const portfolios = await this.getPortfolios(id);
    const track = await this.getTrackById(id);
    if (!end) {
      end = track.end;
    }
    const values = await Promise.all([
      await this.getCurrencyRates(track.start),
      await this.getCurrencyRates(end)
    ]);

    const ratios = this.getRatios(values[0], values[1]);

    const playersStats = [];

    for (let i = 0; i < portfolios.length; i++) {
      playersStats.push({
        player: portfolios[i].user,
        score: this.calculateScore(portfolios[i], ratios)
      });
    }

    return playersStats.sort((a, b) => { return b.score - a.score; });
  }

  async getWinners(id: string): Promise<any> {
    const stats = await this.getStats(id);
    const winners = [stats[0]];

    for (let i = 1; i < stats.length; i++) {
      if (winners[0].score === stats[i].score) {
        winners.push(stats[i]);
      } else {
        return winners;
      }
    }

    return winners;
  }

  async getCurrencyRates(timestamp: number): Promise<any> {
    // const values = await Promise.all([
    //   getConnection().mongoManager.find(Currency, {where: {timestamp: { $lte: timestamp }}, order: {timestamp: -1}, take: 5}),
    //   getConnection().mongoManager.find(Currency, {where: {timestamp: { $gt: timestamp }}, order: {timestamp: 1}, take: 5})
    // ]);
    // const lte = values[0];
    // const gt = values[1];
    // const gtTimestampDiff = gt.length > 0 ? gt[0].timestamp - timestamp : timestamp;
    // const ltTimestampDiff = timestamp - lte[0].timestamp;
    // let rates = [];
    // // select the nearest stamp
    // if (gtTimestampDiff < ltTimestampDiff) rates = gt;
    // else rates = lte;
    // const result = {};
    // for (let i = 0; i < rates.length; i++) {
    //   result[rates[i].name] = rates[i].usd;
    // }

    return JSON.parse(await redisGetAsync(timestamp));
  }

  async getRewards(user: User, mnemonic: string, id: string): Promise<string> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.withdrawRewards(account, id);

    return '0'; // TODO: change to an actual reward
  }

  private async addPlayerToTrack(track: Track, player: User, fuel: Asset[], ship: number): Promise<boolean> {
    const exists = await getConnection().mongoManager.find(Track, {
      where: {
        users: { $in: [ player.id.toString() ] },
        status: TRACK_STATUS_AWAITING
      }
    });
    if (exists.length > 0) {
      return false;
    }
    track.addPlayer(player, ship, fuel);
    await this.trackRepo.save(track);

    return true;
  }

  private calculateScore(portfolio: Portfolio, ratios: any): number {
    let score = 0;

    for (let i = 0; i < portfolio.assets.length; i++) {
      score += ratios[portfolio.assets[i].name.toUpperCase()] * portfolio.assets[i].value;
    }

    return score;
  }

  private getRatios(startRates, endRates): any {
    const tickers = ['LTC','BTC', 'XRP', 'ETH', 'BCH'];
    const result = {};
    for (let i = 0; i < tickers.length; i++) {
      result[tickers[i]] = endRates[tickers[i]] / startRates[tickers[i]];
    }
    return result;
  }

  private assetsFromFuel(fuel: Array<string>): Asset[] {
    let result = [];
    for (let i = 0; i < fuel.length; i++) {
      if (i === 5) {
        const name = this.getAssetNameByIndex(Math.floor(Math.random() * 4));
        const found = result.findIndex((elem) => {
          return elem.name === name;
        });
        if (found !== -1) {
          result[found].value += fuel[i];
        } else {
          result.push({
            name: name,
            value: fuel[i]
          });
        }
      } else {
        result.push({
          name: this.getAssetNameByIndex(i),
          value: fuel[i]
        });
      }
    }
    return result;
  }

  private getAssetNameByIndex(index: number): string {
    switch (index) {
      case 0:
        return 'btc';
      case 1:
        return 'eth';
      case 2:
        return 'xrp';
      case 3:
        return 'bch';
      case 4:
        return 'ltc';
    }
  }
}

const TrackServiceType = Symbol('TrackServiceInterface');
export { TrackServiceType };
