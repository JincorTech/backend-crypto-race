import { injectable, inject } from 'inversify';
import { Web3ClientType, Web3ClientInterface } from './web3.client';
import { Track, TRACK_TYPE_BACKEND } from '../entities/track';
import { getConnection } from 'typeorm';

@injectable()
export class GameService implements GameServiceInterface {
  createTrackFromUserAccount(user: any, mnemonic: string, id: string, betAmount: string): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.createTrackFromUserAccount(account, id, betAmount);
  }

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {}

  async createTrackFromBackend(id: string, betAmount: string): Promise<any> {
    await this.web3Client.createTrackFromBackend(id, betAmount);
    const track = new Track();
    track.betAmount = betAmount;
    track.name = id;
    track.maxPlayers = 2; // TODO
    track.numPlayers = 0;
    track.duration = 300;
    track.type = TRACK_TYPE_BACKEND;
    track.hash = this.web3Client.toHexSha3(id);
    track.timestamp = Date.now();
    track.status = TRACK_STATUS_AWAITING;
    return getConnection().mongoManager.save(Track, track);
  }

  async joinToTrack(user: any, mnemonic: string, id: string): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.joinToTrack(account, id);
  }

  async setPortfolio(user: any, mnemonic: string, id: string, portfolio: any): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.setPortfolio(account, id, portfolio);
  }
}

const GameServiceType = Symbol('GameServiceInterface');
export { GameServiceType };
