import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Staff } from './staff.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100, unique: true }) name: string;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Staff, (staff) => staff.team) staff: Staff[];
}
