import * as Redis from 'redis';
import config from '../config';
import * as request from 'web-request';
import { Logger } from '../logger';

const client = Redis.createClient(config.redis.url);

export interface CryptoCurrencyHandlerInterface { }

export class CryptoCurrencyHandler implements CryptoCurrencyHandlerInterface {
  private logger = Logger.getInstance('CRYPTO_CURRENCY_HANDLER');

  constructor() {
    setInterval(
      async() => {
        const now = Math.floor(Date.now() / 1000);
        const currentTime = now % 5 === 0 ? now : now + (5 - (now % 5));
        try {
          const data = await request.json<any>('/data/pricemulti?fsyms=BTC,ETH,LTC,XRP,BCD&tsyms=USD', {
            baseUrl: 'https://min-api.cryptocompare.com',
            method: 'GET'
          });
          const rates = {
            'BTC': data.BTC.USD,
            'ETH': data.ETH.USD,
            'LTC': data.LTC.USD,
            'XRP': data.XRP.USD,
            'BCH': data.BCH.USD
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
