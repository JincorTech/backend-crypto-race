import { Currency } from '../entities/currency';
import { getConnection } from 'typeorm';

const cryptoSocket = require('crypto-socket');

export interface CryptoCurrencyHandlerInterface { }

export class CryptoCurrencyHandler implements CryptoCurrencyHandlerInterface {
  constructor() {
    cryptoSocket.start('poloniex',['LTCUSD','BTCUSD', 'XRPUSD', 'ETHUSD', 'BCHUSD']);
    setInterval(
      async function() {
        const now = Date.now();
        let currentTime = now + (5 - (now % 5));
        let rate = cryptoSocket.Exchanges['bittrex'];
        getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'LTC',
          usd: rate.LTCUSD
        }));
        getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'ETH',
          usd: rate.ETHUSD
        }));
        getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'BTC',
          usd: rate.BTCUSD
        }));
        getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'XRP',
          usd: rate.XRPUSD
        }));
        getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'BCH',
          usd: rate.BCHUSD
        }));
      },
      5000
    );
  }
}

const CryptoCurrencyHandlerType = Symbol('CryptoCurrencyHandlerInterface');
export {CryptoCurrencyHandlerType};
