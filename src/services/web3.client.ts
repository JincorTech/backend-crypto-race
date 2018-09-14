import { injectable } from 'inversify';

const Web3 = require('web3');
const net = require('net');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import config from '../config';
import 'reflect-metadata';
import { Logger } from '../logger';
import * as Redis from 'redis';
import { promisify } from 'util';

const client = Redis.createClient(config.redis.url);
const redisGetAsync = promisify(client.get).bind(client);
const redisSetAsync = promisify(client.set).bind(client);
const redisIncrAsync = promisify(client.incr).bind(client);

export interface Web3ClientInterface {
  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string>;
  sendTransactionByPrivateKey(input: TransactionInput, privateKey: string): Promise<string>;
  generateMnemonic(): string;
  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any;
  getEthBalance(address: string): Promise<string>;
  sufficientBalance(input: TransactionInput): Promise<boolean>;
  getCurrentGasPrice(): Promise<string>;
  investmentFee(): Promise<any>;

  // game
  createTrack(data: CreateTrackData): Promise<any>;
  joinToTrack(data: JoinToTrackData): Promise<any>;
  finishTrack(data: FinishTrackData): Promise<any>;

  isHex(key: any): boolean;
  toHexSha3(value: string): string;
}

/* istanbul ignore next */
@injectable()
export class Web3Client implements Web3ClientInterface {
  private logger = Logger.getInstance('WEB3CLIENT');

  whiteList: any;
  ico: any;
  token: any;
  web3: any;
  raceBase: any;
  rate: any;

  constructor() {
    switch (config.rpc.type) {
      case 'ipc':
        this.web3 = new Web3(new Web3.providers.IpcProvider(config.rpc.address, net));
        break;
      case 'ws':
        const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);

        webSocketProvider.connection.onclose = () => {
          this.logger.info('Web3 socket connection closed');
          this.onWsClose();
        };

        this.web3 = new Web3(webSocketProvider);
        break;
      case 'http':
        this.web3 = new Web3(config.rpc.address);
        break;
      default:
        throw Error('Unknown Web3 RPC type!');
    }

    this.createContracts();
  }

  sendTransactionByMnemonic(input: TransactionInput, mnemonic: string, salt: string): Promise<string> {
    const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
    const params = {
      value: this.web3.utils.toWei(input.amount.toString()),
      from: input.from,
      to: input.to,
      gas: input.gas,
      gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei')
    };

    return new Promise<string>((resolve, reject) => {
      this.sufficientBalance(input).then((sufficient) => {
        if (!sufficient) {
          reject({
            message: 'Insufficient funds to perform this operation and pay tx fee'
          });
        }

        this.web3.eth.accounts.signTransaction(params, privateKey).then(transaction => {
          this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
            .on('transactionHash', transactionHash => {
              resolve(transactionHash);
            })
            .on('error', (error) => {
              reject(error);
            })
            .catch((error) => {
              reject(error);
            });
        });
      });
    });
  }

  sendTransactionByPrivateKey(input: TransactionInput, privateKey: string): Promise<string> {
    const account = this.web3.eth.accounts.privateKeyToAccount(privateKey);

    const params = {
      value: this.web3.utils.toWei(input.amount.toString()),
      from: account.address,
      to: input.to,
      gas: input.gas,
      gasPrice: this.web3.utils.toWei(input.gasPrice, 'gwei')
    };

    return new Promise<string>((resolve, reject) => {
      account.signTransaction(params).then(transaction => {
        this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
          .on('transactionHash', transactionHash => {
            resolve(transactionHash);
          })
          .on('error', (error) => {
            reject(error);
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  generateMnemonic(): string {
    return bip39.generateMnemonic();
  }

  getAccountByMnemonicAndSalt(mnemonic: string, salt: string): any {
    const privateKey = this.getPrivateKeyByMnemonicAndSalt(mnemonic, salt);
    return this.web3.eth.accounts.privateKeyToAccount(privateKey);
  }

  getPrivateKeyByMnemonicAndSalt(mnemonic: string, salt: string) {
    // get seed
    const hdWallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic, salt));

    // get first of available wallets
    const path = 'm/44\'/60\'/0\'/0/0';

    // get wallet
    const wallet = hdWallet.derivePath(path).getWallet();

    // get private key
    return '0x' + wallet.getPrivateKey().toString('hex');
  }

  // game section
  async createTrack(data: CreateTrackData): Promise<any> {
    const nameBates32 = this.web3.utils.toHex(this.web3.utils.sha3(data.id));

    return new Promise(async(resolve, reject) => {
      const account = this.web3.eth.accounts.privateKeyToAccount(config.contracts.raceBase.ownerPk);
      const params = {
        value: '0',
        to: this.raceBase.options.address,
        gas: '2000000',
        nonce: await this.getNonce(account.address),
        data: this.raceBase.methods.createTrack(
          nameBates32,
          this.web3.utils.toBN(data.maxPlayers),
          this.web3.utils.toWei(data.betAmount, 'ether'),
          this.web3.utils.toBN(data.duration)
        ).encodeABI()
      };

      this.signAndSendTransaction(account, params, resolve, reject);
    });
  }

  async joinToTrack(data: JoinToTrackData): Promise<any> {
    const nameBytes32 = this.web3.utils.toHex(this.web3.utils.sha3(data.id));
    const names = new Array<string>();
    const amounts = new Array<string>();
    const start = this.web3.utils.toBN(data.start ? data.start : 0);
    const betAmount = this.web3.utils.toWei(data.betAmount, 'ether');

    for (let i = 0; i < data.assets.length; i++) {
      names.push(this.web3.utils.toHex(data.assets[i].name.toLowerCase()));
      amounts.push(this.web3.utils.toBN(data.assets[i].value));
    }

    return new Promise(async(resolve, reject) => {
      const params = {
        value: betAmount,
        to: this.raceBase.options.address,
        gas: '2000000',
        nonce: await this.web3.eth.getTransactionCount(data.account.address, 'pending'),
        data: this.raceBase.methods.joinToTrack(nameBytes32, names, amounts, start).encodeABI()
      };

      this.signAndSendTransaction(data.account, params, resolve, reject);
    });
  }

  async finishTrack(data: FinishTrackData): Promise<any> {
    const idBytes32 = this.web3.utils.toHex(this.web3.utils.sha3(data.id));
    const account = this.web3.eth.accounts.privateKeyToAccount(config.contracts.raceBase.ownerPk);

    const names = new Array<string>();
    const startRates = new Array<string>();
    const endRates = new Array<string>();

    for (let i = 0; i < data.names.length; i++) {
      names.push(this.web3.utils.toHex(data.names[i].toLowerCase()));
      startRates.push(this.web3.utils.toBN(Math.floor(data.startRates[i] * 100)));
      endRates.push(this.web3.utils.toBN(Math.floor(data.endRates[i] * 100)));
    }

    return new Promise(async(resolve, reject) => {
      const params = {
        value: '0',
        to: this.raceBase.options.address,
        gas: '4000000',
        nonce: await this.getNonce(account.address),
        data: this.raceBase.methods.finishTrack(idBytes32, names, startRates, endRates).encodeABI()
      };

      this.signAndSendTransaction(account, params, resolve, reject);
    });
  }

  async getEthBalance(address: string): Promise<string> {
    return this.web3.utils.fromWei(
      await this.web3.eth.getBalance(address)
    );
  }

  sufficientBalance(input: TransactionInput): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.web3.eth.getBalance(input.from)
        .then((balance) => {
          const BN = this.web3.utils.BN;
          const txFee = new BN(input.gas).mul(new BN(this.web3.utils.toWei(input.gasPrice, 'gwei')));
          const total = new BN(this.web3.utils.toWei(input.amount)).add(txFee);
          resolve(total.lte(new BN(balance)));
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  onWsClose() {
    this.logger.error('Web3 socket connection closed. Trying to reconnect');
    const webSocketProvider = new Web3.providers.WebsocketProvider(config.rpc.address);
    webSocketProvider.connection.onclose = () => {
      this.logger.info('Web3 socket connection closed');
      setTimeout(() => {
        this.onWsClose();
      }, config.rpc.reconnectTimeout);
    };

    this.web3.setProvider(webSocketProvider);
    this.createContracts();
  }

  createContracts() {
    this.raceBase = new this.web3.eth.Contract(config.contracts.raceBase.abi, config.contracts.raceBase.address);
    this.rate = new this.web3.eth.Contract(config.contracts.rate.abi, config.contracts.rate.address);
  }

  async getCurrentGasPrice(): Promise<string> {
    return this.web3.utils.fromWei(await this.web3.eth.getGasPrice(), 'gwei');
  }

  async investmentFee(): Promise<any> {
    const gasPrice = await this.getCurrentGasPrice();
    const gas = config.web3.defaultInvestGas;
    const BN = this.web3.utils.BN;

    return {
      gasPrice,
      gas,
      expectedTxFee: this.web3.utils.fromWei(
        new BN(gas).mul(new BN(this.web3.utils.toWei(gasPrice, 'gwei'))).toString()
      )
    };
  }

  isHex(key: any): boolean {
    return this.web3.utils.isHex(key);
  }

  toHexSha3(value: string): string {
    return this.web3.utils.toHex(this.web3.utils.sha3(value));
  }

  private signAndSendTransaction(
    account: any,
    params: { value: string; to: any; gas: string; nonce?: any; data: any; },
    resolve: (value?: {} | PromiseLike<{}> | void | PromiseLike<void>) => void | {},
    reject: (reason?: any) => void
  ) {
    account.signTransaction(params).then(transaction => {
      this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
        .once('transactionHash', async(transactionHash) => {
          await this.incrNonce(account.address);
          resolve(transactionHash);
        })
        .on('error', (error) => {
          reject(error);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private async getNonce(addressAccount: string): Promise<number> {
    const storedNonce = await redisGetAsync(`${addressAccount}.nonce`);
    const ethNonce = await this.web3.eth.getTransactionCount(addressAccount, 'pending');
    if (storedNonce && storedNonce >= ethNonce) {
      return storedNonce;
    }

    await redisSetAsync(`${addressAccount}.nonce`, ethNonce);

    return ethNonce;
  }

  private async incrNonce(addressAccount: string): Promise<void> {
    await redisIncrAsync(`${addressAccount}.nonce`);
  }
}

const Web3ClientType = Symbol('Web3ClientInterface');
export {Web3ClientType};
