import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';

@Entity()
export class Refund extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  transactionId: number;

  @Column()
  merchantTransactionId: string;

  @Column('decimal')
  amount: number;

  @Column({ type: 'enum', enum: ['REQUESTED', 'PROCESSED', 'FAILED'], default: 'REQUESTED' })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  constructor() {
    super();
    this.id = 0;
    this.transactionId = 0;
    this.amount = 0;
    this.status = 'REQUESTED';
    this.createdAt = new Date();
  }
}
