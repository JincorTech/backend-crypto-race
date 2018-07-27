import {
  VerificationClient,
  VerificationClientType
} from '../../services/verify.client';

import {
  Web3ClientInterface,
  Web3ClientType,
  Web3Client
} from '../../services/web3.client';

import { Response, Request, NextFunction } from 'express';

import {
  AuthClient,
  AuthClientType
} from '../../services/auth.client';

import * as express from 'express';
import * as TypeMoq from 'typemoq';
import { container } from '../../ioc.container';
import { InversifyExpressServer } from 'inversify-express-utils';
import * as bodyParser from 'body-parser';
import { Auth } from '../../middlewares/auth';
import handle from '../../middlewares/error.handler';
import { EmailQueue, EmailQueueInterface, EmailQueueType } from '../../queues/email.queue';
import {
  ACTIVATE_USER_SCOPE,
  CHANGE_PASSWORD_SCOPE,
  DISABLE_2FA_SCOPE,
  ENABLE_2FA_SCOPE,
  LOGIN_USER_SCOPE,
  RESET_PASSWORD_SCOPE
} from '../../services/user.service';
import { INVEST_SCOPE } from '../dashboard.controller';
import * as nock from 'nock';
import config from '../../config';

const mockEmailQueue = () => {
  const emailMock = TypeMoq.Mock.ofType(EmailQueue);

  emailMock.setup(x => x.addJob(TypeMoq.It.isAny()))
    .returns((): any => null);

  container.rebind<EmailQueueInterface>(EmailQueueType).toConstantValue(emailMock.object);
};

const mockWeb3 = () => {
  const web3Mock = TypeMoq.Mock.ofType(Web3Client);

  web3Mock.setup(x => x.sendTransactionByMnemonic(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => 'transactionHash');

  web3Mock.setup(x => x.sendTransactionByPrivateKey(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => 'transactionHash');

  web3Mock.setup(x => x.getEthBalance(TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => '1.0001');

  web3Mock.setup(x => x.sufficientBalance(TypeMoq.It.isAny()))
    .returns(async(): Promise<boolean> => true);

  const generatedAccount = {
    address: '0x54c0B824d575c60F3B80ba1ea3A0cCb5EE3F56eA',
    privateKey: '0x54c0B824d575c60F3B80ba1ea3A0cCb5EE3F56eA'
  };

  web3Mock.setup(x => x.getAccountByMnemonicAndSalt(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns((): any => generatedAccount);

  web3Mock.setup(x => x.generateMnemonic())
    .returns((): string => 'pig turn bounce jeans left mouse hammer sketch hold during grief spirit');

  container.rebind<Web3ClientInterface>(Web3ClientType).toConstantValue(web3Mock.object);
};

const mockWeb3Client = () => {
  const web3Mock = TypeMoq.Mock.ofType(Web3Client);

  web3Mock.setup(x => x.sendTransactionByMnemonic(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => 'transactionHash');

  web3Mock.setup(x => x.sendTransactionByPrivateKey(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => 'transactionHash');

  web3Mock.setup(x => x.getEthBalance(TypeMoq.It.isAny()))
    .returns(async(): Promise<string> => '0.1');

  web3Mock.setup(x => x.sufficientBalance(TypeMoq.It.isAny()))
    .returns(async(): Promise<boolean> => true);

  const generatedAccount = {
    address: '0x54c0B824d575c60F3B80ba1ea3A0cCb5EE3F56eA',
    privateKey: '0x54c0B824d575c60F3B80ba1ea3A0cCb5EE3F56eA'
  };

  web3Mock.setup(x => x.getAccountByMnemonicAndSalt(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns((): any => generatedAccount);

  web3Mock.setup(x => x.generateMnemonic())
    .returns((): string => 'pig turn bounce jeans left mouse hammer sketch hold during grief spirit');

  container.rebind<Web3ClientInterface>(Web3ClientType).toConstantValue(web3Mock.object);
};

const mockAuthMiddleware = () => {
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const verifyTokenResult = {
    login: 'activated@test.com'
  };

  const verifyTokenResult2fa = {
    login: '2fa@test.com'
  };

  const verifyTokenResultKycVerified = {
    login: 'kyc.verified@test.com'
  };

  const verifyTokenResultKycFailed3 = {
    login: 'kyc.failed3@test.com'
  };

  const loginResult = {
    accessToken: 'new_token'
  };

  authMock.setup(x => x.verifyUserToken(TypeMoq.It.isValue('verified_token')))
    .returns(async(): Promise<any> => verifyTokenResult);

  authMock.setup(x => x.verifyUserToken(TypeMoq.It.isValue('verified_token_2fa_user')))
    .returns(async(): Promise<any> => verifyTokenResult2fa);

  authMock.setup(x => x.verifyUserToken(TypeMoq.It.isValue('kyc_verified_token')))
    .returns(async(): Promise<any> => verifyTokenResultKycVerified);

  authMock.setup(x => x.verifyUserToken(TypeMoq.It.isValue('kyc_3_failed_token')))
    .returns(async(): Promise<any> => verifyTokenResultKycFailed3);

  authMock.setup(x => x.createUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<any> => {
      return {};
    });

  authMock.setup(x => x.loginUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<any> => loginResult);

  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);

  const auth = new Auth(container.get<AuthClientInterface>(AuthClientType));
  container.rebind<express.RequestHandler>('AuthMiddleware').toConstantValue(
    (req: any, res: any, next: any) => auth.authenticate(req, res, next)
  );
};

const mockVerifyClient = () => {
  const verifyMock = TypeMoq.Mock.ofInstance(container.get<VerificationClientInterface>(VerificationClientType));
  verifyMock.callBase = true;

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  const validationResultToEnable2fa: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'enable_2fa_verification',
      consumer: 'activated@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: ENABLE_2FA_SCOPE
      }
    }
  };

  const validationResultToDisable2fa: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'disable_2fa_verification',
      consumer: '2fa@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: DISABLE_2FA_SCOPE
      }
    }
  };

  const validationResultToVerifyInvestment: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'verify_invest',
      consumer: 'activated@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: INVEST_SCOPE,
        ethAmount: '1'
      }
    }
  };

  const validationResultChangePassword: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'change_password_verification',
      consumer: 'activated@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: CHANGE_PASSWORD_SCOPE
      }
    }
  };

  const validationResultResetPassword: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'reset_password_verification',
      consumer: 'activated@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: RESET_PASSWORD_SCOPE
      }
    }
  };

  const validationResultActivateUser: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'activated_user_verification',
      consumer: 'existing@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: ACTIVATE_USER_SCOPE
      }
    }
  };

  const validationResultVerifyLogin: ValidationResult = {
    status: 200,
    data: {
      verificationId: 'verify_login_verification',
      consumer: 'activated@test.com',
      expiredOn: 123456,
      attempts: 0,
      payload: {
        scope: LOGIN_USER_SCOPE
      }
    }
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  verifyMock.setup(x => x.validateVerification('google_auth', 'enable_2fa_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultToEnable2fa);

  verifyMock.setup(x => x.getVerification('google_auth', 'enable_2fa_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultToEnable2fa);

  verifyMock.setup(x => x.validateVerification('google_auth', 'disable_2fa_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultToDisable2fa);

  verifyMock.setup(x => x.getVerification('google_auth', 'disable_2fa_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultToDisable2fa);

  verifyMock.setup(x => x.validateVerification('email', 'verify_invest', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultToVerifyInvestment);

  verifyMock.setup(x => x.getVerification('email', 'verify_invest'))
    .returns(async(): Promise<ValidationResult> => validationResultToVerifyInvestment);

  verifyMock.setup(x => x.validateVerification('email', 'change_password_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultChangePassword);

  verifyMock.setup(x => x.getVerification('email', 'change_password_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultChangePassword);

  verifyMock.setup(x => x.validateVerification('email', 'reset_password_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultResetPassword);

  verifyMock.setup(x => x.getVerification('email', 'reset_password_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultResetPassword);

  verifyMock.setup(x => x.validateVerification('email', 'activate_user_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultActivateUser);

  verifyMock.setup(x => x.getVerification('email', 'activate_user_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultActivateUser);

  verifyMock.setup(x => x.validateVerification('email', 'verify_login_verification', TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResultVerifyLogin);

  verifyMock.setup(x => x.getVerification('email', 'verify_login_verification'))
    .returns(async(): Promise<ValidationResult> => validationResultVerifyLogin);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
};

export const buildApp = () => {
  const newApp = express();
  newApp.use(bodyParser.json());
  newApp.use(bodyParser.urlencoded({ extended: false }));

  const server = new InversifyExpressServer(container, null, null, newApp);
  server.setErrorConfig((app) => {
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.status(404).send({
        statusCode: 404,
        error: 'Route is not found'
      });
    });

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => handle(err, req, res, next));
  });

  return server.build();
};

export const testAppForSuccessRegistrationWithJumioProvider = () => {
  mockWeb3();

  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  const validationResult: ValidationResult = {
    status: 200,
    data: {
      verificationId: '123',
      consumer: 'test@test.com',
      expiredOn: 123456,
      attempts: 0
    }
  };

  const registrationResult: UserRegistrationResult = {
    id: 'id',
    email: 'test@test.com',
    login: 'test@test.com',
    tenant: 'tenant',
    sub: 'sub'
  };

  const loginResult: AccessTokenResponse = {
    accessToken: 'token'
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  verifyMock.setup(x => x.validateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResult);

  authMock.setup(x => x.createUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<UserRegistrationResult> => registrationResult);

  authMock.setup(x => x.loginUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<AccessTokenResponse> => loginResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
};

export const testAppForSuccessRegistrationWithShuftiproProvider = () => {
  mockWeb3();

  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  const validationResult: ValidationResult = {
    status: 200,
    data: {
      verificationId: '123',
      consumer: 'test@test.com',
      expiredOn: 123456,
      attempts: 0
    }
  };

  const registrationResult: UserRegistrationResult = {
    id: 'id',
    email: 'test@test.com',
    login: 'test@test.com',
    tenant: 'tenant',
    sub: 'sub'
  };

  const loginResult: AccessTokenResponse = {
    accessToken: 'token'
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  verifyMock.setup(x => x.validateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResult);

  authMock.setup(x => x.createUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<UserRegistrationResult> => registrationResult);

  authMock.setup(x => x.loginUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<AccessTokenResponse> => loginResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
};

export const testAppForInitiateLogin = () => {
  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  const loginResult: AccessTokenResponse = {
    accessToken: 'token'
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  authMock.setup(x => x.loginUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<AccessTokenResponse> => loginResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
};

export const testAppForVerifyLogin = () => {
  mockEmailQueue();

  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const verifyTokenResultNotVerified = {
    login: 'activated@test.com'
  };

  authMock.setup(x => x.verifyUserToken(TypeMoq.It.isValue('not_verified_token')))
    .returns(async(): Promise<any> => verifyTokenResultNotVerified);

  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
};

export const testAppForUserMe = () => {
  mockAuthMiddleware();
  return buildApp();
};

export const testAppForDashboardWithJumioProvider = () => {

  mockAuthMiddleware();
  mockVerifyClient();
  mockWeb3();
  return buildApp();
};

export const testAppForDashboardWithShuftiproProvider = () => {
  mockAuthMiddleware();
  mockVerifyClient();
  mockWeb3();
  return buildApp();
};

export const testAppForDashboardWithOldSmartContracts = () => {
  mockAuthMiddleware();
  mockVerifyClient();
  return buildApp();
};

export const testAppForChangePassword = () => {
  mockAuthMiddleware();
  mockVerifyClient();
  return buildApp();
};

export const testAppForInvite = () => {
  mockAuthMiddleware();
  mockEmailQueue();
  return buildApp();
};

export function testAppForResetPassword() {
  mockVerifyClient();
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  authMock.setup(x => x.createUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<any> => null);

  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
}

export function testAppForResendVerification() {
  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  verifyMock.setup(x => x.resendVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);

  return buildApp();
}

export function testAppForSuccessSendTransactionByPrivateKey() {
  mockWeb3Client();

  const verifyMock = TypeMoq.Mock.ofType(VerificationClient);
  const authMock = TypeMoq.Mock.ofType(AuthClient);

  const initiateResult: InitiateResult = {
    status: 200,
    verificationId: '123',
    attempts: 0,
    expiredOn: 124545,
    method: 'email'
  };

  const validationResult: ValidationResult = {
    status: 200,
    data: {
      verificationId: '123',
      consumer: 'test@test.com',
      expiredOn: 123456,
      attempts: 0
    }
  };

  const registrationResult: UserRegistrationResult = {
    id: 'id',
    email: 'test@test.com',
    login: 'test@test.com',
    tenant: 'tenant',
    sub: 'sub'
  };

  const loginResult: AccessTokenResponse = {
    accessToken: 'token'
  };

  verifyMock.setup(x => x.initiateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<InitiateResult> => initiateResult);

  verifyMock.setup(x => x.validateVerification(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
    .returns(async(): Promise<ValidationResult> => validationResult);

  authMock.setup(x => x.createUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<UserRegistrationResult> => registrationResult);

  authMock.setup(x => x.loginUser(TypeMoq.It.isAny()))
    .returns(async(): Promise<AccessTokenResponse> => loginResult);

  container.rebind<VerificationClientInterface>(VerificationClientType).toConstantValue(verifyMock.object);
  container.rebind<AuthClientInterface>(AuthClientType).toConstantValue(authMock.object);
  return buildApp();
}

export function testAppForDashboardAfterActivationUser() {
  mockAuthMiddleware();
  mockVerifyClient();
  mockWeb3Client();
  return buildApp();
}
