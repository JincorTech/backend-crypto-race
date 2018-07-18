import { User } from '../entities/user';
import { VerifiedToken } from '../entities/verified.token';

export function transformUserForAuth(user: User) {
  return {
    email: user.email,
    login: user.email,
    password: user.passwordHash,
    sub: user.verification.id
  };
}

export function transformCreatedUser(user: User): CreatedUserData {
  return {
    id: user.id.toString(),
    email: user.email,
    name: user.name,
    agreeTos: user.agreeTos,
    verification: {
      id: user.verification.id.toString(),
      method: user.verification.method
    },
    isVerified: user.isVerified,
    defaultVerificationMethod: user.defaultVerificationMethod,
    source: user.source
  };
}

export function transformVerifiedToken(token: VerifiedToken): VerifyLoginResult {
  return {
    accessToken: token.token,
    isVerified: token.verified,
    verification: {
      verificationId: token.verification.id,
      method: token.verification.method,
      attempts: token.verification.attempts,
      expiredOn: token.verification.expiredOn,
      status: 200
    }
  };
}
