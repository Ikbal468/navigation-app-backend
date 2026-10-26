import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('report_votes')
@Index(['reportId', 'deviceId'], { unique: true })
export class ReportVote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  reportId: string;

  @Column({ type: 'varchar' })
  deviceId: string;

  @Column({ type: 'boolean' })
  up: boolean;
}
