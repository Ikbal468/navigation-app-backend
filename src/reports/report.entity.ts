import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ReportType {
  POLICE = 'police',
  HAZARD = 'hazard',
  ACCIDENT = 'accident',
  CLOSURE = 'closure',
  TRAFFIC = 'traffic',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  type: ReportType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Index()
  @Column({ type: 'varchar', length: 12 })
  geohash: string;

  @Column({ type: 'integer', default: 0 })
  upvotes: number;

  @Column({ type: 'integer', default: 0 })
  downvotes: number;

  @Index()
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
