import { Entity, Index, ObjectIdColumn, ObjectID, Column } from 'typeorm';

@Entity()
@Index('openId', () => ({ openId: 1 }), { unique: true })
export class OpenId {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  openId: string;
}
