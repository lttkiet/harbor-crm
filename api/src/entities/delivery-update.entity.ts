import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('delivery_updates')
export class DeliveryUpdate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => Order, (order) => order.deliveryUpdates, { onDelete: 'CASCADE' })
  @JoinColumn() order: Order;
  @Column('uuid') orderId: string;
  @Column({ type: 'varchar', length: 30 }) status: string;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 180, nullable: true }) updatedBy: string | null;
  @CreateDateColumn() createdAt: Date;
}
