import { AuthClientType } from './auth.client';
import { VerificationClientType } from './verify.client';
import { Web3ClientType, Web3ClientInterface } from './web3.client';
import { EmailQueueType, EmailQueueInterface } from '../queues/email.queue';
import { injectable, inject } from 'inversify';
import 'reflect-metadata';

import {
  UserExists,
  UserNotFound,
  InvalidPassword,
  UserNotActivated,
  TokenNotFound, AuthenticatorError, UserActivated
} from '../exceptions/exceptions';
import config from '../config';
import { User } from '../entities/user';
import { VerifiedToken } from '../entities/verified.token';
import { AUTHENTICATOR_VERIFICATION, EMAIL_VERIFICATION, Verification } from '../entities/verification';
import * as transformers from '../transformers/transformers';
import { getConnection } from 'typeorm';
import * as bcrypt from 'bcrypt-nodejs';
import { Logger } from '../logger';
import { EmailTemplateServiceType } from './email.template.service';

export const ACTIVATE_USER_SCOPE = 'activate_user';
export const LOGIN_USER_SCOPE = 'login_user';
export const CHANGE_PASSWORD_SCOPE = 'change_password';
export const RESET_PASSWORD_SCOPE = 'reset_password';
export const ENABLE_2FA_SCOPE = 'enable_2fa';
export const DISABLE_2FA_SCOPE = 'disable_2fa';

/**
 * UserService
 */
@injectable()
export class UserService implements UserServiceInterface {
  private logger = Logger.getInstance('USER_SERVICE');

  /**
   * constructor
   *
   * @param  authClient  auth service client
   * @param  verificationClient  verification service client
   * @param  web3Client web3 service client
   * @param  emailQueue email queue
   * @param  kycProvider kycProvider
   * @param  emailTemplateService email template service
   */
  constructor(
    @inject(AuthClientType) private authClient: AuthClientInterface,
    @inject(VerificationClientType) private verificationClient: VerificationClientInterface,
    @inject(Web3ClientType) private web3Client: Web3ClientInterface,
    @inject(EmailQueueType) private emailQueue: EmailQueueInterface,
    @inject(EmailTemplateServiceType) private emailTemplateService: EmailTemplateServiceInterface
  ) { }

  /**
   * Save user's data
   *
   * @param userData user info
   * @return promise
   */
  async create(userData: InputUserData): Promise<CreatedUserData> {
    const email = userData.email.toLowerCase();
    const existingUser = await getConnection().getMongoRepository(User).findOne({
      email: email
    });

    if (existingUser) {
      throw new UserExists('User already exists');
    }

    const logger = this.logger.sub({ email }, '[create] ');

    const encodedEmail = encodeURIComponent(email);
    const link = `${ config.app.frontendUrl }/auth/signup?type=activate&code={{{CODE}}}&verificationId={{{VERIFICATION_ID}}}&email=${ encodedEmail }`;

    logger.debug('Init verification');

    const verification = await this.verificationClient.initiateVerification(EMAIL_VERIFICATION, {
      consumer: email,
      issuer: config.app.companyName,
      template: {
        fromEmail: config.email.from.general,
        subject: `Verify your email at ${config.app.companyName}`,
        body: await this.emailTemplateService.getRenderedTemplate('init-signup', { name: userData.name, link: link })
      },
      generateCode: {
        length: 6,
        symbolSet: [
          'DIGITS'
        ]
      },
      policy: {
        expiredOn: '24:00:00'
      },
      payload: {
        scope: ACTIVATE_USER_SCOPE
      }
    });

    userData.passwordHash = bcrypt.hashSync(userData.password);
    const user = User.createUser(userData, {
      verificationId: verification.verificationId
    });

    await getConnection().mongoManager.save(user);

    logger.debug('Create user in auth');

    await this.authClient.createUser(transformers.transformUserForAuth(user));

    return transformers.transformCreatedUser(user);
  }

  async createActivatedUser(userData: any): Promise<any> {
    const email = userData.email.toLowerCase();
    const existingUser = await getConnection().getMongoRepository(User).findOne({
      email: email
    });

    if (existingUser) {
      return {
        accessToken: await this.getVerifiedAccessToken(existingUser)
      };
    }

    const logger = this.logger.sub({ email }, '[create] ');

    const user = User.createUser(userData, {verificationId: 'stub'});

    await getConnection().mongoManager.save(user);

    logger.debug('Create user in auth');

    await this.authClient.createUser(transformers.transformUserForAuth(user));

    const accessToken = await this.getVerifiedAccessToken(user);

    const mnemonic = this.web3Client.generateMnemonic();
    user.mnemonic = mnemonic;
    const salt = bcrypt.genSaltSync();
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    user.addEthWallet({
      ticker: 'ETH',
      address: account.address,
      balance: '0',
      salt
    });

    const privateKey = config.test_fund.private_key;

    if (privateKey && this.web3Client.isHex(privateKey) && process.env.ENVIRONMENT === 'stage') {
      this.web3Client.sendTransactionByPrivateKey({
        amount: '0.1',
        to: account.address.toString(),
        gas: 21000,
        gasPrice: '4'
      }, privateKey.toString());
    }

    await getConnection().mongoManager.save(user);

    const resultWallets: Array<NewWallet> = [
      {
        ticker: 'ETH',
        address: account.address,
        balance: '0',
        mnemonic: mnemonic,
        privateKey: account.privateKey
      }
    ];

    return {
      accessToken: accessToken,
      wallets: resultWallets
    };
  }

  async resendVerification(userData: ResendVerificationInput): Promise<CreatedUserData> {
    const email = userData.email.toLowerCase();
    const user = await getConnection().getMongoRepository(User).findOne({
      email: email
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (user.isVerified) {
      throw new UserActivated('User is activated already');
    }

    const logger = this.logger.sub({ email }, '[resend] ');

    const encodedEmail = encodeURIComponent(email);
    const link = `${ config.app.frontendUrl }/auth/signup?type=activate&code={{{CODE}}}&verificationId={{{VERIFICATION_ID}}}&email=${ encodedEmail }`;

    logger.debug('Resend verification');

    const verification = await this.verificationClient.resendVerification(EMAIL_VERIFICATION, {
      consumer: email,
      issuer: config.app.companyName,
      template: {
        fromEmail: config.email.from.general,
        subject: `Verify your email at ${config.app.companyName}`,
        body: await this.emailTemplateService.getRenderedTemplate('init-signup', {name: user.name, link: link})
      },
      policy: {
        expiredOn: '24:00:00',
        verificationId: user.verification.id
      },
      payload: {
        scope: ACTIVATE_USER_SCOPE
      }
    });

    user.verification = Verification.createVerification(verification);
    await getConnection().getMongoRepository(User).save(user);

    return transformers.transformCreatedUser(user);
  }

  /**
   * Save user's data
   *
   * @param loginData user info
   * @param ip string
   * @return promise
   */
  async initiateLogin(loginData: InitiateLoginInput, ip: string): Promise<InitiateLoginResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: loginData.email.toLowerCase()
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (!user.isVerified) {
      throw new UserNotActivated('Account is not activated! Please check your email');
    }

    const passwordMatch = bcrypt.compareSync(loginData.password, user.passwordHash);

    if (!passwordMatch) {
      throw new InvalidPassword('Invalid password');
    }

    const logger = this.logger.sub({ email: loginData.email }, '[initiateLogin] ');

    logger.debug('Login user');

    const tokenData = await this.authClient.loginUser({
      login: user.email.toLowerCase(),
      password: user.passwordHash,
      deviceId: 'device'
    });

    logger.debug('Init verification');

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: config.app.companyName,
        template: {
          fromEmail: config.email.from.general,
          subject: `${config.app.companyName} Login Verification Code`,
          body: await this.emailTemplateService.getRenderedTemplate('init-signin', {
            name: user.name,
            datetime: new Date().toUTCString(),
            ip: ip
          })
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '01:00:00'
        },
        payload: {
          scope: LOGIN_USER_SCOPE
        }
      }
    );

    const token = VerifiedToken.createNotVerifiedToken(
      tokenData.accessToken,
      verificationData
    );

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    return {
      accessToken: tokenData.accessToken,
      isVerified: false,
      verification: verificationData
    };
  }

  /**
   * Verify login
   *
   * @param inputData user info
   * @return promise
   */
  async verifyLogin(inputData: VerifyLoginInput): Promise<VerifyLoginResult> {
    const token = await getConnection().getMongoRepository(VerifiedToken).findOne({
      token: inputData.accessToken
    });

    if (!token) {
      throw new TokenNotFound('Token is not found');
    }

    if (token.verification.id !== inputData.verification.id) {
      throw new Error('Invalid verification id');
    }

    this.logger.debug('[verifyLogin] Check access token by auth');

    const verifyAuthResult = await this.authClient.verifyUserToken(inputData.accessToken);

    const user = await getConnection().getMongoRepository(User).findOne({
      email: verifyAuthResult.login.toLowerCase()
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    const logger = this.logger.sub({ email: user.email }, '[verifyLogin] ');

    const inputVerification = {
      verificationId: inputData.verification.id,
      code: inputData.verification.code,
      method: inputData.verification.method
    };

    const payload = {
      scope: LOGIN_USER_SCOPE
    };

    logger.debug('Validate verification');

    await this.verificationClient.checkVerificationPayloadAndCode(inputVerification, user.email, payload);

    token.makeVerified();
    await getConnection().getMongoRepository(VerifiedToken).save(token);

    logger.debug('Send notification');

    const template = await this.emailTemplateService.getRenderedTemplate('success-signin', {
      name: user.name,
      datetime: new Date().toUTCString()
    });

    if (template !== '') {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        subject: `${config.app.companyName} Successful Login Notification`,
        recipient: user.email,
        text: template
      });
    }

    return transformers.transformVerifiedToken(token);
  }

  async activate(activationData: ActivationUserData): Promise<ActivationResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: activationData.email.toLowerCase()
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    if (user.isVerified) {
      throw Error('User is activated already');
    }

    const logger = this.logger.sub({ email: user.email }, '[activate] ');

    const inputVerification = {
      verificationId: activationData.verificationId,
      method: EMAIL_VERIFICATION,
      code: activationData.code
    };

    const payload = {
      scope: ACTIVATE_USER_SCOPE
    };

    logger.debug('Validate verification');

    await this.verificationClient.checkVerificationPayloadAndCode(inputVerification, activationData.email, payload);

    logger.debug('Generate eth wallet');

    const mnemonic = this.web3Client.generateMnemonic();
    const salt = bcrypt.genSaltSync();
    const account = this.web3Client.getAccountByMnemonicAndSalt(mnemonic, salt);

    user.addEthWallet({
      ticker: 'ETH',
      address: account.address,
      balance: '0',
      salt
    });

    logger.debug('Initialization of KYC verification');

    user.isVerified = true;
    await getConnection().getMongoRepository(User).save(user);

    logger.debug('Login user by auth');

    const loginResult = await this.authClient.loginUser({
      login: user.email,
      password: user.passwordHash,
      deviceId: 'device'
    });

    const resultWallets: Array<NewWallet> = [
      {
        ticker: 'ETH',
        address: account.address,
        balance: '0',
        mnemonic: mnemonic,
        privateKey: account.privateKey
      }
    ];

    const token = VerifiedToken.createVerifiedToken(loginResult.accessToken);

    await getConnection().getMongoRepository(VerifiedToken).save(token);

    logger.debug('Send email notification');

    const template = await this.emailTemplateService.getRenderedTemplate('success-signup', { name: user.name });

    if (template !== '') {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: `You are officially registered for participation in ${config.app.companyName}\'s ICO`,
        text: template
      });
    }

    const privateKey = config.test_fund.private_key;

    if (privateKey && this.web3Client.isHex(privateKey) && process.env.ENVIRONMENT === 'stage') {
      this.web3Client.sendTransactionByPrivateKey({
        amount: '0.1',
        to: account.address.toString(),
        gas: 21000,
        gasPrice: '4'
      }, privateKey.toString());
    }

    return {
      accessToken: loginResult.accessToken,
      wallets: resultWallets
    };
  }

  async initiateChangePassword(user: User, params: any): Promise<BaseInitiateResult> {
    if (!bcrypt.compareSync(params.oldPassword, user.passwordHash)) {
      throw new InvalidPassword('Invalid password');
    }

    this.logger.debug('[initiateChangePassword] Initiate verification', { meta: { email: user.email } });

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email,
        issuer: config.app.companyName,
        template: {
          fromEmail: config.email.from.general,
          subject: `Here’s the Code to Change Your Password at ${config.app.companyName}`,
          body: await this.emailTemplateService.getRenderedTemplate('init-change-password', { name: user.name })
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '24:00:00'
        },
        payload: {
          scope: CHANGE_PASSWORD_SCOPE
        }
      }
    );

    return {
      verification: verificationData
    };
  }

  async verifyChangePassword(user: User, params: any): Promise<AccessTokenResponse> {
    if (!bcrypt.compareSync(params.oldPassword, user.passwordHash)) {
      throw new InvalidPassword('Invalid password');
    }

    const logger = this.logger.sub({ email: user.email }, '[verifyChangePassword] ');

    const payload = {
      scope: CHANGE_PASSWORD_SCOPE
    };

    logger.debug('Validate verification');

    await this.verificationClient.checkVerificationPayloadAndCode(params.verification, user.email, payload);

    user.passwordHash = bcrypt.hashSync(params.newPassword);
    await getConnection().getMongoRepository(User).save(user);

    logger.debug('Send notification');

    const template = await this.emailTemplateService.getRenderedTemplate('success-password-change', { name: user.name });

    if (template !== '') {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: `${config.app.companyName} Password Change Notification`,
        text: template
      });
    }

    logger.debug('Recreate user in auth');

    await this.authClient.createUser({
      email: user.email.toLowerCase(),
      login: user.email.toLowerCase(),
      password: user.passwordHash,
      sub: params.verification.verificationId
    });

    logger.debug('Login user in auth');

    const loginResult = await this.authClient.loginUser({
      login: user.email.toLowerCase(),
      password: user.passwordHash,
      deviceId: 'device'
    });

    const token = VerifiedToken.createVerifiedToken(loginResult.accessToken);
    await getConnection().getMongoRepository(VerifiedToken).save(token);
    return loginResult;
  }

  async initiateResetPassword(params: ResetPasswordInput): Promise<BaseInitiateResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email.toLowerCase()
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    this.logger.debug('[initiateResetPassword] Initiate verification', { meta: { email: params.email } });

    const verificationData = await this.verificationClient.initiateVerification(
      user.defaultVerificationMethod,
      {
        consumer: user.email.toLowerCase(),
        issuer: config.app.companyName,
        template: {
          fromEmail: config.email.from.general,
          body: await this.emailTemplateService.getRenderedTemplate('init-reset-password', { name: user.name }),
          subject: `Here’s the Code to Reset Your Password at ${config.app.companyName}`
        },
        generateCode: {
          length: 6,
          symbolSet: ['DIGITS']
        },
        policy: {
          expiredOn: '24:00:00'
        },
        payload: {
          scope: RESET_PASSWORD_SCOPE
        }
      }
    );

    return {
      verification: verificationData
    };
  }

  async verifyResetPassword(params: ResetPasswordInput): Promise<ValidationResult> {
    const user = await getConnection().getMongoRepository(User).findOne({
      email: params.email.toLowerCase()
    });

    if (!user) {
      throw new UserNotFound('User is not found');
    }

    const logger = this.logger.sub({ email: user.email }, '[verifyResetPassword] ');

    const payload = {
      scope: RESET_PASSWORD_SCOPE
    };

    logger.debug('Validate verification');

    const verificationResult = await this.verificationClient.checkVerificationPayloadAndCode(params.verification, params.email.toLowerCase(), payload);

    user.passwordHash = bcrypt.hashSync(params.password);
    await getConnection().getMongoRepository(User).save(user);

    logger.debug('Recreate user in auth');

    await this.authClient.createUser({
      email: user.email.toLowerCase(),
      login: user.email.toLowerCase(),
      password: user.passwordHash,
      sub: params.verification.verificationId
    });

    logger.debug('Send notification');

    const template = await this.emailTemplateService.getRenderedTemplate('success-password-reset', { name: user.name });

    if (template !== '') {
      this.emailQueue.addJob({
        sender: config.email.from.general,
        recipient: user.email,
        subject: `${config.app.companyName} Password Reset Notification`,
        text: template
      });
    }

    return verificationResult;
  }

  private async initiate2faVerification(user: User, scope: string): Promise<InitiateResult> {
    this.logger.debug('[initiate2faVerification] Initiate verification', { meta: { email: user.email } });

    return await this.verificationClient.initiateVerification(
      AUTHENTICATOR_VERIFICATION,
      {
        consumer: user.email,
        issuer: config.app.companyName,
        policy: {
          expiredOn: '01:00:00'
        },
        payload: {
          scope
        }
      }
    );
  }

  async initiateEnable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod === AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is enabled already');
    }

    return {
      verification: await this.initiate2faVerification(user, ENABLE_2FA_SCOPE)
    };
  }

  async verifyEnable2fa(user: User, params: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod === AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is enabled already');
    }

    const logger = this.logger.sub({ email: user.email }, '[verifyEnable2fa] ');

    const payload = {
      scope: ENABLE_2FA_SCOPE
    };

    logger.debug('Validate verification');

    await this.verificationClient.checkVerificationPayloadAndCode(params.verification, user.email, payload);

    user.defaultVerificationMethod = AUTHENTICATOR_VERIFICATION;

    await getConnection().getMongoRepository(User).save(user);

    return {
      enabled: true
    };
  }

  async initiateDisable2fa(user: User): Promise<BaseInitiateResult> {
    if (user.defaultVerificationMethod !== AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is disabled already');
    }

    return {
      verification: await this.initiate2faVerification(user, DISABLE_2FA_SCOPE)
    };
  }

  async verifyDisable2fa(user: User, params: VerificationInput): Promise<Enable2faResult> {
    if (user.defaultVerificationMethod !== AUTHENTICATOR_VERIFICATION) {
      throw new AuthenticatorError('Authenticator is disabled already');
    }

    const logger = this.logger.sub({ email: user.email }, '[verifyEnable2fa] ');

    const payload = {
      scope: DISABLE_2FA_SCOPE
    };

    logger.debug('Validate verification');

    await this.verificationClient.checkVerificationPayloadAndCode(params.verification, user.email.toLowerCase(), payload, true);

    user.defaultVerificationMethod = EMAIL_VERIFICATION;

    await getConnection().getMongoRepository(User).save(user);

    return {
      enabled: false
    };
  }

  async getUserInfo(user: User): Promise<UserInfo> {
    return {
      ethAddress: user.ethWallet.address,
      email: user.email.toLowerCase(),
      name: user.name,
      defaultVerificationMethod: user.defaultVerificationMethod
    };
  }

  async getVerifiedAccessToken(user: User): Promise<string> {
    const tokenData = await this.authClient.loginUser({
      login: user.email.toLowerCase(),
      password: user.passwordHash,
      deviceId: 'device'
    });

    const token = VerifiedToken.createVerifiedToken(tokenData.accessToken);
    await getConnection().getMongoRepository(VerifiedToken).save(token);

    return tokenData.accessToken;
  }
}

const UserServiceType = Symbol('UserServiceInterface');
export { UserServiceType };
