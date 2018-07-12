import { Entity, Index, ObjectIdColumn, ObjectID, Column } from 'typeorm';

@Entity()
@Index('email', () => ({ email: 1 }), { unique: true })
export class EarlyAccess {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  email: string;
}
