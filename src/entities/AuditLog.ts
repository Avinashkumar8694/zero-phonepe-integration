import { Entity, PrimaryGeneratedColumn, Column, BaseEntity, CreateDateColumn } from 'typeorm';

@Entity()
export class AuditLog extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  action: string;

  @Column()
  details: string;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'simple-json', nullable: true }) // JSON object type for metadata
  request: object;
  @Column({ type: 'simple-json', nullable: true }) // JSON object type for metadata
  response: object;

  constructor() {
    super();
    this.id = 0;
    this.action = '';
    this.details = '';
    this.timestamp = new Date();
  }
}
