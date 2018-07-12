import { Column, Entity } from 'typeorm';
import 'reflect-metadata';

export class Profile {
  @Column()
  name: string;

  @Column()
  gender: string;

  @Column()
  location: string;

  @Column()
  website: string;

  @Column()
  picture: string;
}
