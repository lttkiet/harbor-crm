import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Customer } from './customer.entity';
import { DeliveryUpdate } from './delivery-update.entity';
import { LedgerEntry } from './ledger-entry.entity';
import { Staff } from './staff.entity';

export type OrderType = 'buy' | 'transport';
export type OrderStatus = 'new' | 'sourcing' | 'ready' | 'in_transit' | 'delivered' | 'cancelled';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 20, unique: true }) orderNumber: string;
  @Column({ type: 'varchar', length: 20 }) type: OrderType;
  @Column({ type: 'varchar', length: 30, default: 'new' }) status: OrderStatus;
  @ManyToOne(() => Customer, (customer) => customer.orders, { onDelete: 'RESTRICT' })
  @JoinColumn()
  customer: Customer;
  @Column('uuid') customerId: string;
  @Column({ type: 'uuid', nullable: true }) warehouseStaffId: string | null;
  @ManyToOne(() => Staff, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'warehouseStaffId' })
  warehouseAssignee: Staff | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) supplierName: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) carrierName: string | null;
  @Column({ type: 'varchar', length: 200, nullable: true }) trackingNumber: string | null;
  @Column({ type: 'text', nullable: true }) origin: string | null;
  @Column({ type: 'text', nullable: true }) destination: string | null;
  @Column({ type: 'text', nullable: true }) cargoDescription: string | null;
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" }) items: Array<{ name: string; quantity: number; unitCost: number }>;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) customerTotal: string;
  @Column({ type: 'numeric', precision: 14, scale: 2, default: 0 }) estimatedCost: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @OneToMany(() => LedgerEntry, (entry) => entry.order) ledgerEntries: LedgerEntry[];
  @OneToMany(() => DeliveryUpdate, (update) => update.order) deliveryUpdates: DeliveryUpdate[];
}
