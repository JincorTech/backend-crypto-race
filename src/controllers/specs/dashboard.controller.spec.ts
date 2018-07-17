import * as chai from 'chai';
import * as factory from './test.app.factory';
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

describe('Dashboard', () => {
  describe('GET /dashboard', () => {
    it('should get dashboard data', (done) => {
      const token = 'verified_token';

      getRequest(factory.testAppForDashboardWithJumioProvider(), '/dashboard').set('Authorization', `Bearer ${ token }`).end((err, res) => {
        expect(res.status).to.equal(200);
        expect(res.body).to.deep.eq({
          ethBalance: '1.0001'
        });
        done();
      });
    });

    it('should equal balance to 0.1 ETH after actiovation user', (done) => {
      const token = 'verified_token';

      getRequest(factory.testAppForDashboardAfterActivationUser(), '/dashboard').set('Authorization', `Bearer ${ token }`).end((err, res) => {
        expect(res.status).to.eq(200);
        expect(res.body.ethBalance).to.eq('0.1');
        done();
      });
    });
  });
});
