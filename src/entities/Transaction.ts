import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, OneToMany } from 'typeorm';
import { Refund } from './Refund';

@Entity()
export class Transaction extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  merchantTransactionId: string;

  @Column()
  userId: string;

  @Column('decimal')
  amount: number;

  @Column({ type: 'enum', enum: ['INITIATED', 'SUCCESS', 'FAILED', 'REFUNDED'], default: 'INITIATED' })
  status: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  constructor() {
    super();
  }
}
