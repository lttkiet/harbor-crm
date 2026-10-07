import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

export type LedgerKind = 'customer_charge' | 'customer_payment' | 'supplier_cost' | 'supplier_payment' | 'carrier_cost' | 'carrier_payment';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Order, (order) => order.ledgerEntries, { onDelete: 'CASCADE' })
  @JoinColumn()
  order: Order;
  @Column('uuid') orderId: string;
  @Column({ type: 'varchar', length: 30 }) kind: LedgerKind;
  @Column({ type: 'numeric', precision: 14, scale: 2 }) amount: string;
  @Column({ type: 'varchar', length: 80, nullable: true }) method: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) reference: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'date' }) occurredOn: string;
  @CreateDateColumn() createdAt: Date;
}
