import { Container } from 'inversify';
import { UserController } from './controllers/user.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { interfaces, TYPE } from 'inversify-express-utils';
import { UserService, UserServiceType } from './services/user.service';
import { AuthClientType, AuthClient } from './services/auth.client';
import { VerificationClientType, VerificationClient } from './services/verify.client';
import { Web3ClientInterface, Web3ClientType, Web3Client } from './services/web3.client';
import { MailgunService } from './services/mailgun.service';
import { EmailServiceType } from './types';
import { EmailQueueType, EmailQueueInterface, EmailQueue } from './queues/email.queue';
import { Auth } from './middlewares/auth';
import config from './config';
import * as express from 'express';
import * as validation from './middlewares/request.validation';
import { MailjetService } from './services/mailjet.service';
import { EmailTemplateService, EmailTemplateServiceType } from './services/email.template.service';
import { LandingServiceType, LandingService } from './services/landing.service';
import { GameController } from './controllers/game.controller';
import { GameServiceType, GameService } from './services/game.service';

let container = new Container();

// services
if (process.env.MAIL_DRIVER === 'mailjet') {
  container.bind<EmailServiceInterface>(EmailServiceType).to(MailjetService).inSingletonScope();
} else {
  container.bind<EmailServiceInterface>(EmailServiceType).to(MailgunService).inSingletonScope();
}

container.bind<EmailQueueInterface>(EmailQueueType).to(EmailQueue).inSingletonScope();
container.bind<Web3ClientInterface>(Web3ClientType).to(Web3Client).inSingletonScope();

container.bind<AuthClientInterface>(AuthClientType).toConstantValue(new AuthClient(config.auth.baseUrl));
container.bind<VerificationClientInterface>(VerificationClientType).toConstantValue(new VerificationClient(config.verify.baseUrl));
container.bind<UserServiceInterface>(UserServiceType).to(UserService).inSingletonScope();

container.bind<EmailTemplateServiceInterface>(EmailTemplateServiceType).to(EmailTemplateService).inSingletonScope();
container.bind<LandingServiceInterface>(LandingServiceType).to(LandingService).inSingletonScope();
container.bind<GameServiceInterface>(GameServiceType).to(GameService).inSingletonScope();

const auth = new Auth(container.get<AuthClientInterface>(AuthClientType));
// middlewares
container.bind<express.RequestHandler>('AuthMiddleware').toConstantValue(
  (req: any, res: any, next: any) => auth.authenticate(req, res, next)
);
container.bind<express.RequestHandler>('CreateUserValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.createUser(req, res, next)
);
container.bind<express.RequestHandler>('ActivateUserValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.activateUser(req, res, next)
);
container.bind<express.RequestHandler>('InitiateLoginValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.initiateLogin(req, res, next)
);
container.bind<express.RequestHandler>('VerifyLoginValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.verifyLogin(req, res, next)
);
container.bind<express.RequestHandler>('ChangePasswordValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.changePassword(req, res, next)
);
container.bind<express.RequestHandler>('ResetPasswordInitiateValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.resetPasswordInitiate(req, res, next)
);
container.bind<express.RequestHandler>('ResetPasswordVerifyValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.resetPasswordVerify(req, res, next)
);
container.bind<express.RequestHandler>('VerificationRequiredValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.verificationRequired(req, res, next)
);
container.bind<express.RequestHandler>('ResendVerificationValidation').toConstantValue(
  (req: any, res: any, next: any) => validation.resendVerification(req, res, next)
);
container.bind<express.RequestHandler>('OnlyAcceptApplicationJson').toConstantValue(
  (req: any, res: any, next: any) => validation.onlyAcceptApplicationJson(req, res, next)
);

// controllers
container.bind<interfaces.Controller>(TYPE.Controller).to(UserController).whenTargetNamed('UserController');
container.bind<interfaces.Controller>(TYPE.Controller).to(DashboardController).whenTargetNamed('DashboardController');
container.bind<interfaces.Controller>(TYPE.Controller).to(GameController).whenTargetNamed('GameController');

export { container };
