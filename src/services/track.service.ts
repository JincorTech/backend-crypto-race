import { injectable, inject } from 'inversify';
import { User } from '../entities/user';
import { Portfolio } from '../entities/portfolio';
import { Track } from '../entities/track';
import { Web3ClientInterface, Web3ClientType } from './web3.client';
import { getConnection } from 'typeorm';

export interface TrackServiceInterface {
  joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<boolean>;
  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Array<Asset>
  ): Promise<Portfolio>;
  getAllTracks(): Promise<Array<Track>>;
  getTrackByName(name: string): Promise<Track>;
  getTracksByUser(user: User): Promise<Array<Track>>;
  activeTracks(): Promise<Array<Track>>;
  awaitingTracks(): Promise<Array<Track>>;
  createTrack(user: User, mnemonic: string, track: Track): Promise<Track>;
}

@injectable()
export class TrackService implements TrackServiceInterface {

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {}

  async createTrack(user: User, mnemonic: string, track: Track): Promise<Track> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    const hash = this.web3Client.createTrackFromUserAccount(account, track.name, track.betAmount);

    await getConnection().mongoManager.save(Track, track);

    return track;
  }

  async activeTracks(): Promise<Track[]> {
    return getConnection().mongoManager.find(Track, {where: {isActive: true}});
  }

  async awaitingTracks(): Promise<Track[]> {
    return getConnection().mongoManager.find(Track, {where: {isActive: false}});
  }

  async joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<boolean> {
    try {
      const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
      this.web3Client.joinToTrack(account, nameTrack);
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
    portfolioEntity.track = (await getConnection().mongoManager.findOne(Track, {where: {name: nameTrack}})).id;
    portfolioEntity.user = user.id;
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    this.web3Client.setPortfolio(account, nameTrack, portfolio);

    await getConnection().mongoManager.save(Portfolio, portfolioEntity);

    return portfolioEntity;
  }

  async getAllTracks(): Promise<Track[]> {
    return getConnection().mongoManager.find(Track);
  }

  async getTrackByName(name: string): Promise<Track> {
    return getConnection().mongoManager.findOne(Track, {where: {name: name}});
  }

  async getTracksByUser(user: User): Promise<Track[]> {
    return getConnection().mongoManager.find(Track, {where: {creator: user.id}});
  }
}

const TrackServiceType = Symbol('TrackServiceInterface');
export { TrackServiceType };
