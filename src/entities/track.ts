import { Entity, ObjectIdColumn, ObjectID, Column } from 'typeorm';

export const TRACK_TYPE_USER = 'user';
export const TRACK_TYPE_BACKEND = 'backend';

export const TRACK_STATUS_AWAITING = 'awaiting';
export const TRACK_STATUS_STARTING = 'starting';
export const TRACK_STATUS_ACTIVE = 'active';
export const TRACK_STATUS_FINISHED = 'finished';
export const TRACK_STATUS_CANCELLED = 'cancelled';

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
  maxPlayers: number;

  @Column()
  betAmount: string;

  @Column()
  type: string;

  @Column()
  creator?: ObjectID;

  @Column()
  status: string;

  @Column()
  type: string;

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
