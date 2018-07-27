import { ObjectID, Entity, ObjectIdColumn, Column } from 'typeorm';

@Entity()
export class Currency {
  @ObjectIdColumn()
  id: ObjectID;

  @Column()
  name: string;

  @Column()
  usd: number;

  @Column()
  timestamp: number;

  static createCurrency(data: any): Currency {
    const currency = new Currency();
    currency.timestamp = data.timestamp;
    currency.name = data.name;
    currency.usd = data.usd;

    return currency;
  }
}
