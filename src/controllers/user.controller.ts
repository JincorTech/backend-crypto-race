import config from '../config';
import { Response, Request, NextFunction } from 'express';
import { UserServiceType } from '../services/user.service';
import { inject, injectable } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';
import 'reflect-metadata';
import { AuthorizedRequest } from '../requests/authorized.request';
import * as passport from 'passport';
/**
 * UserController
 */
@injectable()
@controller(
  '/user',
  'OnlyAcceptApplicationJson'
)
export class UserController {
  constructor(
    @inject(UserServiceType) private userService: UserServiceInterface
  ) {}

  /**
   * Create user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/',
    'CreateUserValidation'
  )
  async create(req: Request, res: Response): Promise<void> {
    res.json(await this.userService.create(req.body));
  }

  /**
   * Activate user
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/activate',
    'ActivateUserValidation'
  )
  async activate(req: Request, res: Response): Promise<void> {
    res.json(await this.userService.activate(req.body));
  }

  /**
   * Initiate user login
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/login/initiate',
    'InitiateLoginValidation'
  )
  async initiateLogin(req: Request, res: Response): Promise<void> {
    let ip = req.header(config.app.clientIpHeader as string) || req.ip;

    if (ip.substr(0, 7) === '::ffff:') {
      ip = ip.substr(7);
    }

    res.json(await this.userService.initiateLogin(req.body, ip));
  }

  /**
   * Verify user login
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpPost(
    '/login/verify',
    'VerifyLoginValidation'
  )
  async validateLogin(req: Request, res: Response): Promise<void> {
    res.status(200).send(await this.userService.verifyLogin(req.body));
  }

  /**
   * Get user info
   *
   * @param  req  express req object
   * @param  res  express res object
   */
  @httpGet(
    '/me',
    'AuthMiddleware'
  )
  async getMe(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.getUserInfo(req.user));
  }

  @httpPost(
    '/me/changePassword/initiate',
    'AuthMiddleware',
    'ChangePasswordValidation'
  )
  async initiateChangePassword(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.initiateChangePassword(req.user, req.body));
  }

  @httpPost(
    '/me/changePassword/verify',
    'AuthMiddleware',
    'ChangePasswordValidation'
  )
  async verifyChangePassword(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.verifyChangePassword(req.user, req.body));
  }

  @httpPost(
    '/resetPassword/initiate',
    'ResetPasswordInitiateValidation'
  )
  async initiateResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userService.initiateResetPassword(req.body));
  }

  @httpPost(
    '/resetPassword/verify',
    'ResetPasswordVerifyValidation'
  )
  async verifyResetPassword(req: Request, res: Response): Promise<void> {
    res.json(await this.userService.verifyResetPassword(req.body));
  }

  @httpGet(
    '/enable2fa/initiate',
    'AuthMiddleware'
  )
  async enable2faInitiate(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.initiateEnable2fa(req.user));
  }

  @httpPost(
    '/enable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async enable2faVerify(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.verifyEnable2fa(req.user, req.body));
  }

  @httpGet(
    '/disable2fa/initiate',
    'AuthMiddleware'
  )
  async disable2faInitiate(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.initiateDisable2fa(req.user));
  }

  @httpPost(
    '/disable2fa/verify',
    'AuthMiddleware',
    'VerificationRequiredValidation'
  )
  async disable2faVerify(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json(await this.userService.verifyDisable2fa(req.user, req.body));
  }

  @httpPost(
    '/resendVerification',
    'ResendVerificationValidation'
  )
  async resendVerification(req: Request, res: Response): Promise<void> {
    res.json(await this.userService.resendVerification(req.body));
  }

  @httpGet(
    '/auth/facebook/token'
  )
  async authFacebookToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    (function(userService) {
      passport.authenticate('facebook-token', {session: false}, async function(err, user, info) {
        if (err) {
          if (err.oauthError) {
            const oauthError = JSON.parse(err.oauthError.data);
            return res.status(401).send(oauthError.error.message);
          } else {
            return res.send(err);
          }
        } else {
          console.log("user: ", user);
          const result = await userService.createActivatedUser({
            agreeTos: true,
            email: user.email,
            name: user.name,
            picture: user.picture,
            password: 'Stub',
            passwordHash: 'Stub'
          });
          return res.status(200).json(result);
        }
      })(req, res, next);
    })(this.userService);
  }
}
