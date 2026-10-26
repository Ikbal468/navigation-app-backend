import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('speed_logs')
export class SpeedLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 12 })
  geohash: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;

  @Column({ type: 'float' })
  speed: number;

  @Column({ type: 'float', nullable: true })
  heading: number | null;

  @Column({ type: 'bigint' })
  timestamp: number;
}
