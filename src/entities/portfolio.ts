import { ObjectID, Entity, ObjectIdColumn, Column } from 'typeorm';

@Entity()
export class Portfolio {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  user: ObjectID;

  @Column()
  track: ObjectID;

  @Column()
  assets: Array<Asset>;
}
