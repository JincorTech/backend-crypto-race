import * as chai from 'chai';
import * as factory from './test.app.factory';
import { getConnection } from 'typeorm';
import { EarlyAccess } from '../../entities/early.access';
require('../../../test/load.fixtures');

chai.use(require('chai-http'));
const { expect, request } = chai;

const postRequest = (customApp, url: string) => {
  return request(customApp)
    .post(url)
    .set('Accept', 'application/json');
};

const getRequest = (customApp, url: string) => {
  return request(customApp)
    .get(url)
    .set('Accept', 'application/json');
};

describe('Game', () => {
  describe('POST /game/early', () => {
    it('should store email', (done) => {
      postRequest(factory.buildApp(), '/game/early').send({email: 'test@test.com'}).end((err, res) => {
        expect(res.status).to.equal(200);
        getConnection().mongoManager.findOne(EarlyAccess, {email: 'test@test.com'}).then((res) => {
          expect(res.email).to.eq('test@test.com');
          done();
        });
      });
    });
  });
});
