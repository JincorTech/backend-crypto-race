import { Currency } from '../entities/currency';
import { getConnection } from 'typeorm';
import * as Redis from 'redis';
import config from '../config';

const cryptoSocket = require('crypto-socket');
const client = Redis.createClient(config.redis.url);

export interface CryptoCurrencyHandlerInterface { }

export class CryptoCurrencyHandler implements CryptoCurrencyHandlerInterface {
  constructor() {
    setInterval(
      async function() {
        cryptoSocket.start('bittrex',['LTCUSD','BTCUSD', 'XRPUSD', 'ETHUSD', 'BCHUSD']);
        const now = Math.floor(Date.now() / 1000);
        let currentTime = now % 5 === 0 ? now : now + (5 - (now % 5));
        let rate = cryptoSocket.Exchanges['bittrex'];
        let rates = {
          LTC: rate.LTCUSD,
          ETH: rate.ETHUSD,
          BTC: rate.BTCUSD,
          XRP: rate.XRPUSD,
          BCH: rate.BCHUSD
        };

        client.setex(currentTime.toString(), 60 * 15, JSON.stringify(rates));
      },
      5000
    );
  }
}

const CryptoCurrencyHandlerType = Symbol('CryptoCurrencyHandlerInterface');
export {CryptoCurrencyHandlerType};
