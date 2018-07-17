import { injectable, inject } from 'inversify';
import { Web3ClientType, Web3ClientInterface } from './web3.client';

@injectable()
export class GameService implements GameServiceInterface {
  createTrackFromUserAccount(user: any, mnemonic: string, id: string, betAmount: number): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.createTrackFromUserAccount(account, id, betAmount);
  }

  constructor(@inject(Web3ClientType) private web3Client: Web3ClientInterface) {}

  createTrackFromBackend(id: string, betAmount: number): Promise<any> {
    return this.web3Client.createTrackFromBackend(id, betAmount);
  }

  async joinToTrack(user: any, mnemonic: string, id: string): Promise<any> {
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, user.ethWallet.salt);
    return this.web3Client.joinToTrack(account, id);
  }
}

const GameServiceType = Symbol('GameServiceInterface');
export { GameServiceType };
