import * as chai from 'chai';
import {} from 'chai-shallow-deep-equal';
import * as factory from './test.app.factory';
import { getConnection } from 'typeorm';
import { EarlyAccess } from '../../entities/early.access';
import { Track } from '../../entities/track';
import { ObjectID } from 'typeorm';
require('../../../test/load.fixtures');

chai.use(require('chai-http'));
chai.use(require('chai-shallow-deep-equal'));
const { expect, request } = chai;

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
        name: 'toTheMoon',
        duration: 300,
        betAmount: 500,
        numPlayers: 4
      };

      postRequest(factory.testAppForDashboardWithJumioProvider(), '/game/track')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...track, mnemonic: 'seed' })
        .end((err, res) => {
          expect(res.status).to.equal(200);
          expect(res.body).to.shallowDeepEqual({
            ...track,
            hash: '123456',
            status: 'pending',
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
          name: 'starTrack',
          hash: 'hash',
          timestamp: 123456,
          duration: 300,
          numPlayers: 4,
          betAmount: 1000,
          type: 'user',
          creator: '59f07e23b41f6373f64a8dca',
          status: 'pending'
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

  describe('GET /game/track/:name', () => {
    it('should get track by name', done => {
      const track = {
        id: '5a041e9295b9822e1b617777',
        name: 'starTrack',
        hash: 'hash',
        timestamp: 123456,
        duration: 300,
        numPlayers: 4,
        betAmount: 1000,
        type: 'user',
        creator: '59f07e23b41f6373f64a8dca',
        status: 'pending'
      };
      getRequest(
        factory.testAppForDashboardWithJumioProvider(),
        '/game/track/starTrack'
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
        name: 'starTrack',
        hash: 'hash',
        timestamp: 123456,
        duration: 300,
        numPlayers: 4,
        betAmount: 1000,
        type: 'user',
        creator: '59f07e23b41f6373f64a8dca',
        status: 'pending'
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
