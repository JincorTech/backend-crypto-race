import { injectable } from 'inversify';

const Web3 = require('web3');
const net = require('net');

const bip39 = require('bip39');
const hdkey = require('ethereumjs-wallet/hdkey');
import config from '../config';
import 'reflect-metadata';
import { Logger } from '../logger';

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
  createTrackFromBackend(id: string, betAmount: number): Promise<any>;

  createTrackFromUserAccount(account: any, id: string, betAmount: number): Promise<any>;

  joinToTrack(account: any, id: string): Promise<any>;

  getBetAmount(id: string): Promise<string>;

  setPortfolio(account: any, id: string, portfolio: any): Promise<any>;

  isHex(key: any): boolean;
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

  createTrackFromBackend(id: string, betAmount: number): Promise<any> {
    const nameBates32 = this.web3.utils.toHex(this.web3.utils.sha3(id));

    return new Promise(async(resolve, reject) => {
      const account = this.web3.eth.accounts.privateKeyToAccount(config.contracts.raceBase.ownerPk);
      const params = {
        value: '0',
        to: this.raceBase.options.address,
        gas: 200000,
        nonce: await this.web3.eth.getTransactionCount(account.address, 'pending'),
        data: this.raceBase.methods.createTrackFromBack(nameBates32, betAmount).encodeABI()
      };

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

  createTrackFromUserAccount(account: any, id: string, betAmount: number): Promise<any> {
    const nameBates32 = this.web3.utils.toHex(this.web3.utils.sha3(id));

    return new Promise(async(resolve, reject) => {
      const params = {
        value: betAmount,
        to: this.raceBase.options.address,
        gas: 2000000,
        nonce: await this.web3.eth.getTransactionCount(account.address, 'pending'),
        data: this.raceBase.methods.createTrack(nameBates32).encodeABI()
      };

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

  async joinToTrack(account: any, id: string): Promise<any> {
    const nameBytes32 = this.web3.utils.toHex(this.web3.utils.sha3(id));

    return new Promise(async(resolve, reject) => {
      const params = {
        value: await this.getBetAmount(id),
        to: this.raceBase.options.address,
        gas: 2000000,
        nonce: await this.web3.eth.getTransactionCount(account.address, 'pending'),
        data: this.raceBase.methods.joinToTrack(nameBytes32).encodeABI()
      };

      account.signTransaction(params).then(transaction => {
        this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
          .on('transactionHash', transactionHash => {
            console.log(transactionHash);
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

  async setPortfolio(account: any, id: string, portfolio: any): Promise<any> {
    const nameBytes32 = this.web3.utils.toHex(this.web3.utils.sha3(id));
    const names = new Array<string>();
    const amounts = new Array<string>();

    for (let i = 0; i < portfolio.length; i++) {
      names.push(this.web3.utils.toHex(portfolio[i].name));
      amounts.push(this.web3.utils.toBN(portfolio[i].amount));
    }

    return new Promise(async(resolve, reject) => {
      const params = {
        value: '0',
        to: this.raceBase.options.address,
        gas: 2000000,
        nonce: await this.web3.eth.getTransactionCount(account.address, 'pending'),
        data: this.raceBase.methods.setPortfolio(nameBytes32, names, amounts).encodeABI()
      };

      console.log(params);

      account.signTransaction(params).then(transaction => {
        this.web3.eth.sendSignedTransaction(transaction.rawTransaction)
          .on('transactionHash', transactionHash => {
            console.log(transactionHash);
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

  async getBetAmount(id: string): Promise<string> {
    const nameBytes32 = this.web3.utils.toHex(this.web3.utils.sha3(id));
    return await this.raceBase.methods.getBetAmount(nameBytes32).call();
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
}

const Web3ClientType = Symbol('Web3ClientInterface');
export {Web3ClientType};
