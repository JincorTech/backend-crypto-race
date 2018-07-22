import { injectable, inject } from 'inversify';
import { Web3ClientType, Web3ClientInterface } from './web3.client';
import { Track, TRACK_TYPE_BACKEND, TRACK_STATUS_AWAITING } from '../entities/track';
import {getConnection} from 'typeorm';
import { ObjectID } from 'mongodb';

@injectable()
export class GameService implements GameServiceInterface {
  async createTrackFromUserAccount(user: any, mnemonic: string, id: string, betAmount: string): Promise<Track> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.createTrackFromUserAccount(account, id, betAmount);
  }

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {}

  async createTrackFromBackend(id: string, betAmount: string): Track {
    const track = new Track();
    track.betAmount = betAmount;
    track.name = id;
    track.maxPlayers = 3; // TODO
    track.numPlayers = 0;
    track.duration = 300;
    track.type = TRACK_TYPE_BACKEND;
    track.hash = this.web3Client.toHexSha3(id);
    track.timestamp = Date.now();
    track.status = TRACK_STATUS_AWAITING;
    await getConnection().mongoManager().save(Track, track);
    return track;
  }

  async joinToTrack(user: any, mnemonic: string, id: string): Promise<any> {
    console.log('id: ', id);
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    const track = await getConnection().mongoManager.getRepository(Track).findOneById(new ObjectID(id));
    console.log("Track is: ", track);
    // return this.web3Client.joinToTrack(account, id);
  }

  async setPortfolio(user: any, mnemonic: string, id: string, portfolio: any): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.setPortfolio(account, id, portfolio);
  }

  async getAllTracks(): Promise<Array<Track>> {
    return await getConnection().mongoManager.find(Track);
  }

  async getTrackByName(name: string): Promise<Track> {
    return getConnection().mongoManager.findOne(Track, {where: {name: name}});
  }

  async getTracksByUser(user: User): Promise<Array<Track>> {
    return getConnection().mongoManager.find(Track, {where: {creator: user.id}});
  }
}

const GameServiceType = Symbol('GameServiceInterface');
export { GameServiceType };
