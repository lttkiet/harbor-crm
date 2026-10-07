import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { JoinColumn, ManyToOne } from 'typeorm';
import { Team } from './team.entity';

export type StaffRole = 'admin' | 'operations' | 'warehouse' | 'finance';

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 180, unique: true }) email: string;
  @Column({ type: 'varchar', length: 32 }) role: StaffRole;
  @Column({ type: 'varchar', length: 180, nullable: true }) firebaseUid: string | null;
  @Column({ type: 'varchar', length: 100, nullable: true, select: false }) passwordHash: string | null;
  @Column({ type: 'boolean', default: false }) mustChangePassword: boolean;
  @Column({ type: 'integer', default: 0 }) sessionVersion: number;
  @Column({ type: 'uuid', nullable: true }) teamId: string | null;
  @ManyToOne(() => Team, (team) => team.staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teamId' })
  team: Team | null;
  @Column({ type: 'boolean', default: false }) isTeamLead: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
