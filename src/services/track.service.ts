import { injectable, inject } from 'inversify';
import { User } from '../entities/user';
import { Portfolio } from '../entities/portfolio';
import { Track } from '../entities/track';

export interface TrackServiceInterface {
  joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<Track>;
  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Array<Asset>
  ): Promise<Portfolio>;
  getAllTracks(): Promise<Array<Track>>;
  getTrackByName(name: string): Promise<Track>;
  getTracksByUser(user: User): Promise<Array<Track>>;
  activeTracks(): Promise<Array<Track>>;
  awaitingTracks(): Promise<Array<Track>>;
}

@injectable()
export class TrackService implements TrackServiceInterface {
  activeTracks(): Promise<Track[]> {
    throw new Error('Method not implemented.');
  }

  awaitingTracks(): Promise<Track[]> {
    throw new Error('Method not implemented.');
  }

  joinToTrack(user: User, mnemonic: string, nameTrack: string): Promise<Track> {
    throw new Error('Method not implemented.');
  }

  setPortfolio(
    user: User,
    mnemonic: string,
    nameTrack: string,
    portfolio: Asset[]
  ): Promise<Portfolio> {
    throw new Error('Method not implemented.');
  }

  getAllTracks(): Promise<Track[]> {
    throw new Error('Method not implemented.');
  }

  getTrackByName(name: string): Promise<Track> {
    throw new Error('Method not implemented.');
  }

  getTracksByUser(user: User): Promise<Track[]> {
    throw new Error('Method not implemented.');
  }
}

const TrackServiceType = Symbol('TrackServiceInterface');
export { TrackServiceType };
