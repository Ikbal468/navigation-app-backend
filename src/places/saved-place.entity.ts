import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('saved_places')
export class SavedPlace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  deviceId: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'float' })
  latitude: number;

  @Column({ type: 'float' })
  longitude: number;
}
