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
  isActive: boolean;

  @Column()
  start: number;

  @Column()
  end: number;

  @Column()
  users: Array<ObjectID>;

  @Column()
  players: Array<Player>;

  constructor() {
    this.players = [];
    this.users = [];
  }

  static createTrack(betAmount: string, type: string): Track {
    const track = new Track();
    track.betAmount = betAmount;
    track.duration = 300;
    track.maxPlayers = 4;
    track.numPlayers = 0;
    track.status = TRACK_STATUS_AWAITING;
    track.timestamp = Date.now();
    track.type = type;

    return track;
  }
}
