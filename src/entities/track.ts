import { Entity, ObjectIdColumn, ObjectID, Column } from 'typeorm';
import {User} from "./user";

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
  users: Array<string>;

  @Column()
  players: Array<Player>;

  @Column()
  winners: Array<any>;

  constructor() {
    this.players = [];
    this.users = [];
    this.winners = [];
  }

  static createTrack(betAmount: string, type: string): Track {
    const track = new Track();
    track.betAmount = betAmount;
    track.duration = 300;
    track.maxPlayers = 2;
    track.numPlayers = 0;
    track.status = TRACK_STATUS_AWAITING;
    track.timestamp = Date.now();
    track.type = type;

    return track;
  }

  addPlayer(player: User, ship: string, fuel: Asset[]) : boolean {
    if (this.status !== TRACK_STATUS_AWAITING) {
      return false;
    }
    if (this.maxPlayers === this.numPlayers) {
      return false;
    }
    this.numPlayers++;
    this.users.push(player.id.toString());
    this.players.push({
      id: player.id.toString(),
      email: player.email,
      picture: player.picture,
      name: player.name,
      position: this.getPlayerStartingPosition(this.numPlayers),
      ship: { type: ship },
      x: this.getPlayerStartingX(this.maxPlayers, this.numPlayers),
      fuel: fuel
    });

    if (this.numPlayers === this.maxPlayers) {
      this.status = TRACK_STATUS_ACTIVE;
      const now = Date.now();
      this.start = now + (5 - (now % 5));
      this.end = this.start + this.duration;
    }
    return true;
  }

  /**
   * Get x coordinate for the players starting position
   * Player's starting point depends on the number of players in race(player's number)
   * and maximal allowed number of players
   *
   * @param maxPlayers
   * @param numPlayers
   * @returns {number}
   */
  getPlayerStartingX(maxPlayers: number, numPlayers: number) {
    switch (maxPlayers) {
      case 2:
        if (numPlayers === 1) return 33.3;
        return 66.6;
      case 3:
        if (numPlayers === 1) return 25;
        else if (numPlayers === 2) return 50;
        else return 75;
      case 4:
        if (numPlayers === 1) return 20;
        else if (numPlayers === 2) return 40;
        else if (numPlayers === 3) return 60;
        else return 80;
      case 5:
        if (numPlayers === 1) return 15;
        else if (numPlayers === 2) return 30;
        else if (numPlayers === 3) return 45;
        else if (numPlayers === 4) return 60;
        else return 75;
    }
  }

  /**
   * Get starting position of the player
   *
   * @param numPlayers
   * @returns {number}
   */
  getPlayerStartingPosition(numPlayers: number) {
    return numPlayers - 1;
  }
}
