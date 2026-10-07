import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Order } from './order.entity';
import { WarehouseLocation } from './warehouse-location.entity';

export type WarehouseMovementType = 'receipt' | 'pick' | 'dispatch';

@Entity('warehouse_movements')
@Index('UQ_warehouse_dispatch_source', ['sourceMovementId'], { unique: true, where: '"sourceMovementId" IS NOT NULL' })
export class WarehouseMovement {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 16 }) type: WarehouseMovementType;
  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' })
  item: InventoryItem;
  @Column('uuid') itemId: string;
  @ManyToOne(() => WarehouseLocation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'locationId' })
  location: WarehouseLocation;
  @Column('uuid') locationId: string;
  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;
  @Column({ type: 'uuid', nullable: true }) orderId: string | null;
  @Column({ type: 'uuid', nullable: true }) sourceMovementId: string | null;
  @Column({ type: 'integer' }) quantity: number;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @Column({ type: 'varchar', length: 180 }) performedBy: string;
  @CreateDateColumn() createdAt: Date;
}
