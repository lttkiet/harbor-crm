import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('warehouse_locations')
@Unique('UQ_warehouse_location_warehouse_code', ['warehouseName', 'code'])
export class WarehouseLocation {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 180 }) warehouseName: string;
  @Column({ type: 'varchar', length: 60 }) code: string;
  @Column({ type: 'text', nullable: true }) address: string | null;
  @CreateDateColumn() createdAt: Date;
}
