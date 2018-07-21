import { Entity, ObjectIdColumn, ObjectID, Column } from 'typeorm';

export const TRACK_TYPE_USER = 'user';
export const TRACK_TYPE_BACKEND = 'backend';

export const TRACK_STATUS_PENDING = 'pending';
export const TRACK_STATUS_SUCCESS = 'success';
export const TRACK_STATUS_FAILED = 'failed';

@Entity()
export class Track {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  name: string;

  @Column()
  hash: string;

  @Column()
  timestamp: number;

  @Column()
  duration: number;

  @Column()
  numPlayers: number;

  @Column()
  betAmount: string;

  @Column()
  type: string;

  @Column()
  creator?: ObjectID;

  @Column()
  status: string;

  @Column()
  isActive: boolean;

  @Column()
  start: number;

  @Column()
  end: number;

  @Column()
  players: Array<ObjectID>;

  constructor() {
    this.players = new Array<ObjectID>();
  }
}
