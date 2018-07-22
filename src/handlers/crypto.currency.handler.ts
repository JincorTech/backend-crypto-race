import { Currency } from '../entities/currency';
import { getConnection } from 'typeorm';

const cryptoSocket = require('crypto-socket');

export interface CryptoCurrencyHandlerInterface { }

export class CryptoCurrencyHandler implements CryptoCurrencyHandlerInterface {
  constructor() {
    const now = Date.now();
    let currentTime = now + (5 - (now % 5));
    cryptoSocket.start('bittrex',['LTCUSD','BTCUSD', 'XRPUSD', 'ETHUSD', 'BCHUSD']);
    setInterval(
      async function() {
        let rate = cryptoSocket.Exchanges['bittrex'];
        console.log(rate);
        await getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'LTC',
          usd: rate.LTCUSD
        }));
        await getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'ETH',
          usd: rate.ETHUSD
        }));
        await getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'BTC',
          usd: rate.BTCUSD
        }));
        await getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'XRP',
          usd: rate.XRPUSD
        }));
        await getConnection().mongoManager.save(Currency, Currency.createCurrency({
          timestamp: currentTime,
          name: 'BCH',
          usd: rate.BCHUSD
        }));

        currentTime += 5;
      },
      5000
    );
  }
}

const CryptoCurrencyHandlerType = Symbol('CryptoCurrencyHandlerInterface');
export {CryptoCurrencyHandlerType};
