import { injectable, inject } from 'inversify';
import { controller, httpPost } from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import { LandingServiceType } from '../services/landing.service';

@injectable()
@controller(
  '/game',
  'OnlyAcceptApplicationJson'
)
export class GameController {

  constructor(
    @inject(LandingServiceType) private landingService: LandingServiceInterface
  ) {}

  @httpPost(
    '/early'
  )
  async earlyAccess(req: Request, res: Response): Promise<void> {
    const email = req.body.email;
    await this.landingService.storeEmail(email);

    res.json({status: 200});
  }
}
