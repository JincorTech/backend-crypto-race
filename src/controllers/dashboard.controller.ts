import { Request, Response, NextFunction } from 'express';
import { inject, injectable } from 'inversify';
import { controller, httpGet } from 'inversify-express-utils';
import 'reflect-metadata';
import { AuthorizedRequest } from '../requests/authorized.request';
import { Web3ClientInterface, Web3ClientType } from '../services/web3.client';
import { Logger } from '../logger';

export const INVEST_SCOPE = 'invest';

/**
 * Dashboard controller
 */
@injectable()
@controller(
  '/dashboard',
  'OnlyAcceptApplicationJson'
)
export class DashboardController {
  private logger = Logger.getInstance('DASHBOARD_CONTROLLER');

  constructor(
    @inject(Web3ClientType) private web3Client: Web3ClientInterface
  ) {}

  /**
   * Get main dashboard data
   */
  @httpGet(
    '/',
    'AuthMiddleware'
  )
  async dashboard(req: AuthorizedRequest, res: Response): Promise<void> {
    res.json({
      ethBalance: await this.web3Client.getEthBalance(req.user.ethWallet.address)
    });
  }

  @httpGet(
    '/public'
  )
  async publicData(req: Request, res: Response): Promise<void> {
    res.json({});
  }
}
