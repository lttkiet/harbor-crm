import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('inventory_items')
export class InventoryItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 80, unique: true }) sku: string;
  @Column({ type: 'varchar', length: 180 }) name: string;
  @Column({ type: 'varchar', length: 30, default: 'each' }) unit: string;
  @Column({ type: 'integer', default: 0 }) reorderLevel: number;
  @CreateDateColumn() createdAt: Date;
}
