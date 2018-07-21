import { injectable, inject } from 'inversify';
import { User } from '../entities/user';
import { Portfolio } from '../entities/portfolio';
import { Track } from '../entities/track';
import { Web3ClientInterface, Web3ClientType } from './web3.client';
import { getConnection, MongoRepository } from 'typeorm';

export interface TrackServiceInterface {
  joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<boolean>;
  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Array<Asset>
  ): Promise<Portfolio>;
  getPortfolio(user: User, name: string);
  getAllTracks(): Promise<Array<Track>>;
  getTrackByName(name: string): Promise<Track>;
  getTracksByUser(user: User): Promise<Array<Track>>;
  activeTracks(): Promise<Array<Track>>;
  awaitingTracks(): Promise<Array<Track>>;
  createTrack(user: User, mnemonic: string, track: Track): Promise<Track>;
  getPlayers(name: string): Promise<Array<User>>;
}

@injectable()
export class TrackService implements TrackServiceInterface {
  private trackRepo: MongoRepository<Track>;

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {
    this.trackRepo = getConnection().mongoManager.getMongoRepository(Track);
  }

  async createTrack(user: User, mnemonic: string, track: Track): Promise<Track> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    const hash = this.web3Client.createTrackFromUserAccount(account, track.name, track.betAmount);

    await this.trackRepo.save(track);
    await this.addPlayerToTrack(track, user);

    return track;
  }

  async activeTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {isActive: true}});
  }

  async awaitingTracks(): Promise<Track[]> {
    return this.trackRepo.find({where: {isActive: false}});
  }

  async joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<boolean> {
    try {
      const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
      this.web3Client.joinToTrack(account, nameTrack);
      const track = await this.getTrackByName(nameTrack);
      await this.addPlayerToTrack(track, user);
      return true;
    } catch (error) {
      throw(error);
    }
  }

  async setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Asset[]
  ): Promise<Portfolio> {
    const portfolioEntity = new Portfolio();
    portfolioEntity.assets = portfolio;
    portfolioEntity.track = (await this.trackRepo.findOne({where: {name: nameTrack}})).id;
    portfolioEntity.user = user.id;
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.setPortfolio(account, nameTrack, portfolio);

    await getConnection().mongoManager.save(Portfolio, portfolioEntity);

    return portfolioEntity;
  }

  async getPortfolio(user: User, name: string): Promise<Portfolio> {
    const track = await this.getTrackByName(name);
    return getConnection().mongoManager.findOne(Portfolio, {where: {track: track.id, user: user.id}});
  }

  async getAllTracks(): Promise<Track[]> {
    return this.trackRepo.find();
  }

  async getTrackByName(name: string): Promise<Track> {
    return this.trackRepo.findOne({where: {name: name}});
  }

  async getTracksByUser(user: User): Promise<Track[]> {
    return this.trackRepo.find({where: {creator: user.id}});
  }

  async getPlayers(name: string): Promise<User[]> {
    const track = await this.getTrackByName(name);
    return getConnection().mongoManager.findByIds(User, track.players);
  }

  private async addPlayerToTrack(track: Track, player: User): Promise<boolean> {
    track.players.push(player.id);
    await this.trackRepo.save(track);
    return true;
  }
}

const TrackServiceType = Symbol('TrackServiceInterface');
export { TrackServiceType };
