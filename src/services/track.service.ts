import { injectable, inject } from 'inversify';
import { User } from '../entities/user';
import { Portfolio } from '../entities/portfolio';
import { Track, TRACK_TYPE_BACKEND, TRACK_STATUS_AWAITING, TRACK_TYPE_USER, TRACK_STATUS_ACTIVE } from '../entities/track';
import { Web3ClientInterface, Web3ClientType } from './web3.client';
import { getConnection, MongoRepository } from 'typeorm';
import { ObjectID } from 'mongodb';

export interface TrackServiceInterface {
  joinToTrack(user: User, mnemonic: string, id: string): Promise<Track>;
  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Array<Asset>
  ): Promise<Portfolio>;
  getPortfolio(user: User, id: string);
  getAllTracks(): Promise<Array<Track>>;
  getTrackById(name: string): Promise<Track>;
  getTracksByUser(user: User): Promise<Array<Track>>;
  activeTracks(): Promise<Array<Track>>;
  awaitingTracks(): Promise<Array<Track>>;
  createTrack(user: User, mnemonic: string, betAmount: string): Promise<Track>;
  internalCreateTrack(betAmount: string): Promise<Track>;
  getPlayers(id: string): Promise<Array<User>>;
  startTrack(id: string): Promise<boolean>;
}

@injectable()
export class TrackService implements TrackServiceInterface {
  private trackRepo: MongoRepository<Track>;

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {
    this.trackRepo = getConnection().mongoManager.getMongoRepository(Track);
  }

  async createTrack(user: User, mnemonic: string, betAmount: string): Promise<Track> {
    const track = Track.createTrack(betAmount, TRACK_TYPE_USER);
    track.creator = user.id;
    await this.trackRepo.save(track);

    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    const hash = this.web3Client.createTrackFromUserAccount(account, track.id.toHexString(), betAmount);

    await this.addPlayerToTrack(track, user);

    return track;
  }

  async internalCreateTrack(betAmount: string): Promise<Track> {
    const track = new Track();
    track.betAmount = betAmount;
    track.maxPlayers = 2; // TODO
    track.numPlayers = 0;
    track.duration = 300;
    track.type = TRACK_TYPE_BACKEND;
    track.timestamp = Date.now();
    track.status = TRACK_STATUS_AWAITING;
    await getConnection().mongoManager.getRepository(Track).save(track);

    this.web3Client.createTrackFromBackend(track.id.toHexString(), betAmount);

    return track;
  }

  async activeTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {status: TRACK_STATUS_ACTIVE}});
  }

  async awaitingTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {status: TRACK_STATUS_AWAITING}});
  }

  async joinToTrack(user: User, mnemonic: string, id: string): Promise<Track> {
    try {
      const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
      this.web3Client.joinToTrack(account, id);
      const track = await this.getTrackById(id);
      await this.addPlayerToTrack(track, user);
      return track;
    } catch (error) {
      throw(error);
    }
  }

  async setPortfolio(
    user: User,
    mnemonic: string,
    id: string,
    portfolio: Asset[]
  ): Promise<Portfolio> {
    const portfolioEntity = new Portfolio();
    portfolioEntity.assets = portfolio;
    portfolioEntity.track = new ObjectID(id);
    portfolioEntity.user = user.id;
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.setPortfolio(account, id, portfolio);

    await getConnection().mongoManager.save(Portfolio, portfolioEntity);

    return portfolioEntity;
  }

  async getPortfolio(user: User, id: string): Promise<Portfolio> {
    const track = await this.getTrackById(id);
    return getConnection().mongoManager.findOne(Portfolio, {where: {track: track.id, user: user.id}});
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

  async getPlayers(id: string): Promise<User[]> {
    const track = await this.getTrackById(id);
    return getConnection().mongoManager.findByIds(User, track.users);
  }

  async startTrack(name: string): Promise<boolean> {
    const track = await this.getTrackById(name);
    track.status = TRACK_STATUS_ACTIVE;

    await this.trackRepo.save(track);

    return true;
  }

  private async addPlayerToTrack(track: Track, player: User): Promise<boolean> {
    track.users.push(player.id);
    await this.trackRepo.save(track);
    return true;
  }
}

const TrackServiceType = Symbol('TrackServiceInterface');
export { TrackServiceType };
