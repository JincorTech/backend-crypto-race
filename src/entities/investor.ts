import { Column, Entity, ObjectID, ObjectIdColumn } from 'typeorm';
import { Verification, EMAIL_VERIFICATION } from './verification';
import { Wallet } from './wallet';
import 'reflect-metadata';
import { InviteIsNotAllowed } from '../exceptions/exceptions';
import { Index } from 'typeorm/decorator/Index';
import { base64encode } from '../helpers/helpers';
import config from '../config';

export const KYC_STATUS_NOT_VERIFIED = 'not_verified';
export const KYC_STATUS_VERIFIED = 'verified';
export const KYC_STATUS_FAILED = 'failed';
export const KYC_STATUS_PENDING = 'pending';

@Entity()
@Index('email', () => ({ email: 1 }), { unique: true })
export class Investor {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  email: string;

  @Column()
  name: string;

  @Column()
  passwordHash: string;

  @Column()
  agreeTos: boolean;

  @Column()
  isVerified: boolean;

  @Column()
  defaultVerificationMethod: string;

  @Column()
  source: any;

  @Column(type => Verification)
  verification: Verification;

  @Column(type => Wallet)
  ethWallet: Wallet;

  static createInvestor(data: UserData, verification) {
    const user = new Investor();
    user.email = data.email.toLowerCase();
    user.name = data.name;
    user.agreeTos = data.agreeTos;
    user.passwordHash = data.passwordHash;
    user.isVerified = false;
    user.defaultVerificationMethod = EMAIL_VERIFICATION;
    user.verification = Verification.createVerification({
      verificationId: verification.verificationId,
      method: EMAIL_VERIFICATION
    });
    user.source = data.source;
    return user;
  }

  addEthWallet(data: any) {
    this.ethWallet = Wallet.createWallet(data);
  }
}
