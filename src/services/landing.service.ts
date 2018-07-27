import { injectable, inject } from 'inversify';
import { getConnection } from 'typeorm';
import { EarlyAccess } from '../entities/early.access';

@injectable()
export class LandingService implements LandingServiceInterface {
  async storeEmail(email: string): Promise<void> {
    const earlyAccessRepo = getConnection().mongoManager.getMongoRepository(EarlyAccess);
    await earlyAccessRepo.save(earlyAccessRepo.create({email: email}));
  }
}

const LandingServiceType = Symbol('LandingServiceInterface');
export { LandingServiceType };
