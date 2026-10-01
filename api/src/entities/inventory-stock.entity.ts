import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { WarehouseLocation } from './warehouse-location.entity';

@Entity('inventory_stock')
@Index('UQ_inventory_stock_item_location', ['itemId', 'locationId'], { unique: true })
export class InventoryStock {
  @PrimaryGeneratedColumn('uuid') id: string;
  @ManyToOne(() => InventoryItem, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'itemId' }) item: InventoryItem;
  @Column('uuid') itemId: string;
  @ManyToOne(() => WarehouseLocation, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'locationId' }) location: WarehouseLocation;
  @Column('uuid') locationId: string;
  @Column({ type: 'integer', default: 0 }) quantityOnHand: number;
  @Column({ type: 'integer', default: 0 }) quantityPicked: number;
  @UpdateDateColumn() updatedAt: Date;
}
