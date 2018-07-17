import { injectable, inject } from 'inversify';
import { controller, httpPost, httpGet } from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import { LandingServiceType } from '../services/landing.service';
import { GameServiceType } from '../services/game.service';
import { AuthorizedRequest } from '../requests/authorized.request';

@injectable()
@controller(
  '/game',
  'OnlyAcceptApplicationJson'
)
export class GameController {

  constructor(
    @inject(LandingServiceType) private landingService: LandingServiceInterface,
    @inject(GameServiceType) private gameService: GameServiceInterface
  ) {}

  @httpPost(
    '/early'
  )
  async earlyAccess(req: Request, res: Response): Promise<void> {
    const email = req.body.email;
    await this.landingService.storeEmail(email);

    res.json({status: 200});
  }

  @httpPost(
    '/createtrackfrombackend'
  )
  async createTrackFromBackend(req: Request, res: Response): Promise<void> {
    try {
      await this.gameService.createTrackFromBackend(req.body.id, req.body.betAmount);
      res.status(200).json({ statusCode: 200, id: req.body.id});
    } catch (error) {
      res.send(error);
    }
  }

  @httpPost(
    '/createtrack',
    'AuthMiddleware'
  )
  async createTrackFromUserAccount(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      await this.gameService.createTrackFromUserAccount(req.user, req.body.mnemonic, req.body.id, req.body.betAmount);
      res.status(200).json({ statusCode: 200, id: req.body.id });
    } catch (error) {
      res.send(error);
    }
  }

  @httpPost(
    '/jointotrack',
    'AuthMiddleware'
  )
  async joinToTrack(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      await this.gameService.joinToTrack(req.user, req.body.mnemonic, req.body.id);
      res.status(200).json({ statusCode: 200 });
    } catch (error) {
      console.log('error');
      res.send(error);
    }
  }
}
