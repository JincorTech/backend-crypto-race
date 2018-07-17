import * as chai from 'chai';
const { expect } = chai;
import { Investor } from '../../entities/investor';

describe('Investor Entity', () => {
  beforeEach(() => {
    const userData = {
      email: 'invitor@test.com',
      name: 'ICO investor',
      agreeTos: true
    };

    const verification = {
      verificationId: '123'
    };

    this.investor = Investor.createInvestor(userData, verification);
  });
});
