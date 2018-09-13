import * as Redis from 'redis';
import config from '../config';
import * as request from 'web-request';
import { Logger } from '../logger';
import { getUnixtimeMultiplesOfFive } from '../helpers/helpers';

const client = Redis.createClient(config.redis.url);

export interface CryptoCurrencyHandlerInterface { }

export class CryptoCurrencyHandler implements CryptoCurrencyHandlerInterface {
  private logger = Logger.getInstance('CRYPTO_CURRENCY_HANDLER');

  constructor() {
    setInterval(
      async() => {
        const currentTime = getUnixtimeMultiplesOfFive();
        try {
          const data = await request.json<any>('/data/pricemulti?fsyms=BTC,ETH,LTC,XRP,BCH&tsyms=USD', {
            baseUrl: 'https://min-api.cryptocompare.com',
            method: 'GET'
          });
          const rates = {
            'btc': data.BTC.USD,
            'eth': data.ETH.USD,
            'ltc': data.LTC.USD,
            'xrp': data.XRP.USD,
            'bch': data.BCH.USD
          };

          client.setex(currentTime.toString(), 60 * 15, JSON.stringify(rates));
        } catch (error) {
          this.logger.exception(error);
        }
      },
      5000
    );
    this.logger.verbose('CryptoCurrencyHandler started.');
  }
}

const CryptoCurrencyHandlerType = Symbol('CryptoCurrencyHandlerInterface');
export { CryptoCurrencyHandlerType };
