import { Column, Entity, ObjectIdColumn, ObjectID } from 'typeorm';
import 'reflect-metadata';
import { Profile } from './profile';

@Entity()
export class User {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column()
  passwordResetToken: string;

  @Column()
  passwordResetExpires: Date;

  @Column()
  facebook: string;

  @Column()
  tokens: Array<AuthToken>;

  @Column(type => Profile)
  profile: Profile;

  constructor() {
    this.tokens = new Array<AuthToken>();
  }
}

export class AuthToken {
  @Column()
  accessToken: string;

  @Column()
  kind: string;
}
