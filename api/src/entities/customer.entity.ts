import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';
import { Staff } from './staff.entity';
import { JoinColumn, ManyToOne } from 'typeorm';

export type CustomerType = 'business' | 'individual';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 20 }) type: CustomerType;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ type: 'varchar', length: 180, nullable: true }) contactName: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) taxId: string | null;
  @Column({ type: 'varchar', length: 180, nullable: true }) email: string | null;
  @Column({ type: 'varchar', length: 40, nullable: true }) phone: string | null;
  @Column({ type: 'text', nullable: true }) address: string | null;
  @Column({ type: 'uuid', nullable: true }) ownerStaffId: string | null;
  @ManyToOne(() => Staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ownerStaffId' })
  ownerStaff: Staff | null;
  @CreateDateColumn() createdAt: Date;
  @OneToMany(() => Order, (order) => order.customer) orders: Order[];
}
