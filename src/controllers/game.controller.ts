import { injectable, inject } from 'inversify';
import { controller, httpPost, httpGet, requestParam, response } from 'inversify-express-utils';
import { Request, Response, NextFunction } from 'express';
import { LandingServiceType } from '../services/landing.service';
import { AuthorizedRequest } from '../requests/authorized.request';
import { TrackServiceType, TrackServiceInterface } from '../services/track.service';

@injectable()
@controller(
  '/game',
  'OnlyAcceptApplicationJson'
)
export class GameController {

  constructor(
    @inject(LandingServiceType) private landingService: LandingServiceInterface,
    @inject(TrackServiceType) private trackService: TrackServiceInterface
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
      const track = await this.trackService.internalCreateTrack(req.body.betAmount);
      res.status(200).json({ statusCode: 200, id: track.id.toHexString()});
    } catch (error) {
      res.send(error);
    }
  }

  @httpPost(
    '/track',
    'AuthMiddleware'
  )
  async createTrackFromUserAccount(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      const track = await this.trackService.createTrack(req.user, req.body.mnemonic, req.body.betAmount);
      res.status(200).json(track);
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
      await this.trackService.joinToTrack(req.user, req.body.mnemonic, req.body.id);
      res.status(200).json({ statusCode: 200 });
    } catch (error) {
      res.send(error);
    }
  }

  @httpPost(
    '/setportfolio',
    'AuthMiddleware'
  )
  async setPortfolio(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      await this.trackService.setPortfolio(req.user, req.body.mnemonic, req.body.id, req.body.portfolio);
      res.status(200).json({ statusCode: 200 });
    } catch (error) {
      res.send(error);
    }
  }

  @httpGet('/tracks')
  async getAllTracks(req: Request, res: Response): Promise<void> {
    res.send(await this.trackService.getAllTracks());
  }

  @httpGet('/track/:id')
  async getTrackById(@requestParam('id') id, @response() res: Response): Promise<void> {
    res.send(await this.trackService.getTrackById(id));
  }

  @httpGet('/tracks/my', 'AuthMiddleware')
  async getTracksFromCurrentUser(req: AuthorizedRequest, res: Response): Promise<void> {
    res.send(await this.trackService.getTracksByUser(req.user));
  }
}
