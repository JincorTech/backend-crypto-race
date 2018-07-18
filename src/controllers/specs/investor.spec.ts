import * as chai from 'chai';
const { expect } = chai;
import { User } from '../../entities/user';

describe('User Entity', () => {
  beforeEach(() => {
    const userData = {
      email: 'invitor@test.com',
      name: 'ICO investor',
      agreeTos: true
    };

    const verification = {
      verificationId: '123'
    };

    this.user = User.createUser(userData, verification);
  });
});
