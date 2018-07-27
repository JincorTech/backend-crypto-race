import * as chai from 'chai';
import {} from 'chai-shallow-deep-equal';
import * as factory from './test.app.factory';
import { getConnection } from 'typeorm';
import { EarlyAccess } from '../../entities/early.access';
import { TRACK_STATUS_AWAITING } from '../../entities/track';
require('../../../test/load.fixtures');

chai.use(require('chai-http'));
chai.use(require('chai-shallow-deep-equal'));
const { expect, request } = chai;

const EXISTING_TRACK_ID = '5a041e9295b9822e1b617777';

const postRequest = (customApp, url: string) => {
  return request(customApp)
    .post(url)
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json');
};

const getRequest = (customApp, url: string) => {
  return request(customApp)
    .get(url)
    .set('Accept', 'application/json');
};

describe('Game', () => {
  describe('POST /game/early', () => {
    it('should store email', done => {
      postRequest(factory.buildApp(), '/game/early')
        .send({ email: 'test@test.com' })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          getConnection()
            .mongoManager.findOne(EarlyAccess, { email: 'test@test.com' })
            .then(res => {
              expect(res.email).to.eq('test@test.com');
              done();
            });
        });
    });
  });

  describe('POST /game/track', () => {
    it('should create track', done => {
      const token = 'verified_token';

      const track = {
        betAmount: 500
      };

      postRequest(factory.testAppForDashboardWithJumioProvider(), '/game/track')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...track, mnemonic: 'seed' })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body).to.shallowDeepEqual({
            ...track,
            status: TRACK_STATUS_AWAITING,
            type: 'user'
          });
          done();
        });
    });
  });

  describe('GET /game/tracks', () => {
    it('should get all tracks', done => {
      const tracks = [
        {
          id: '5a041e9295b9822e1b617777',
          timestamp: 123456,
          duration: 300,
          betAmount: 1000
        }
      ];
      getRequest(
        factory.testAppForDashboardWithJumioProvider(),
        '/game/tracks'
      ).end((err, res) => {
        expect(res.body).to.shallowDeepEqual(tracks);
        done();
      });
    });
  });

  describe('GET /game/track/:id', () => {
    it('should get track by id', done => {
      const track = {
        id: '5a041e9295b9822e1b617777',
        timestamp: 123456,
        duration: 300,
        betAmount: 1000,
        type: 'user',
        creator: '59f07e23b41f6373f64a8dca'
      };
      getRequest(
        factory.testAppForDashboardWithJumioProvider(),
        '/game/track/' + EXISTING_TRACK_ID
      ).end((err, res) => {
        expect(res.body).to.shallowDeepEqual(track);
        done();
      });
    });
  });

  describe('GET /game/tracks/my', () => {
    it('should get my tracks', done => {
      const token = 'verified_token';
      const tracks = [{
        id: '5a041e9295b9822e1b617777',
        timestamp: 123456,
        duration: 300,
        betAmount: 1000,
        type: 'user',
        creator: '59f07e23b41f6373f64a8dca'
      }];

      getRequest(
        factory.testAppForDashboardWithJumioProvider(),
        '/game/tracks/my'
      )
      .set('Authorization', `Bearer ${token}`)
      .end((err, res) => {
        expect(res.body).to.shallowDeepEqual(tracks);
        done();
      });
    });
  });
});
