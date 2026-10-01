import { MigrationInterface, QueryRunner } from 'typeorm';

export class WarehouseOperations1780250100000 implements MigrationInterface {
  name = 'WarehouseOperations1780250100000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "staff" ADD "sessionVersion" integer NOT NULL DEFAULT 0');
    await queryRunner.query('ALTER TABLE "orders" ADD "warehouseStaffId" uuid');
    await queryRunner.query('ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_warehouseStaff" FOREIGN KEY ("warehouseStaffId") REFERENCES "staff"("id") ON DELETE SET NULL');
    await queryRunner.query('CREATE INDEX "IDX_orders_warehouseStaffId" ON "orders" ("warehouseStaffId")');
    await queryRunner.query(`CREATE TABLE "warehouse_locations" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "warehouseName" character varying(180) NOT NULL,
      "code" character varying(60) NOT NULL,
      "address" text,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_warehouse_locations_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_warehouse_location_warehouse_code" UNIQUE ("warehouseName", "code")
    )`);
    await queryRunner.query(`CREATE TABLE "inventory_items" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "sku" character varying(80) NOT NULL,
      "name" character varying(180) NOT NULL,
      "unit" character varying(30) NOT NULL DEFAULT 'each',
      "reorderLevel" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_inventory_items_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_inventory_items_sku" UNIQUE ("sku"),
      CONSTRAINT "CHK_inventory_items_reorder" CHECK ("reorderLevel" >= 0)
    )`);
    await queryRunner.query(`CREATE TABLE "inventory_stock" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "itemId" uuid NOT NULL,
      "locationId" uuid NOT NULL,
      "quantityOnHand" integer NOT NULL DEFAULT 0,
      "quantityPicked" integer NOT NULL DEFAULT 0,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_inventory_stock_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_inventory_stock_item_location" UNIQUE ("itemId", "locationId"),
      CONSTRAINT "FK_inventory_stock_item" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_inventory_stock_location" FOREIGN KEY ("locationId") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT,
      CONSTRAINT "CHK_inventory_stock_quantities" CHECK ("quantityOnHand" >= 0 AND "quantityPicked" >= 0 AND "quantityPicked" <= "quantityOnHand")
    )`);
    await queryRunner.query(`CREATE TABLE "warehouse_movements" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "type" character varying(16) NOT NULL,
      "itemId" uuid NOT NULL,
      "locationId" uuid NOT NULL,
      "orderId" uuid,
      "sourceMovementId" uuid,
      "quantity" integer NOT NULL,
      "notes" text,
      "performedBy" character varying(180) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_warehouse_movements_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_warehouse_movements_item" FOREIGN KEY ("itemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_warehouse_movements_location" FOREIGN KEY ("locationId") REFERENCES "warehouse_locations"("id") ON DELETE RESTRICT,
      CONSTRAINT "FK_warehouse_movements_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL,
      CONSTRAINT "FK_warehouse_movements_source" FOREIGN KEY ("sourceMovementId") REFERENCES "warehouse_movements"("id") ON DELETE RESTRICT,
      CONSTRAINT "CHK_warehouse_movements_type" CHECK ("type" IN ('receipt', 'pick', 'dispatch')),
      CONSTRAINT "CHK_warehouse_movements_quantity" CHECK ("quantity" > 0),
      CONSTRAINT "CHK_warehouse_movements_source" CHECK (("type" = 'dispatch') = ("sourceMovementId" IS NOT NULL))
    )`);
    await queryRunner.query('CREATE INDEX "IDX_warehouse_movements_createdAt" ON "warehouse_movements" ("createdAt")');
    await queryRunner.query('CREATE INDEX "IDX_warehouse_movements_orderId" ON "warehouse_movements" ("orderId")');
    await queryRunner.query('CREATE UNIQUE INDEX "UQ_warehouse_dispatch_source" ON "warehouse_movements" ("sourceMovementId") WHERE "sourceMovementId" IS NOT NULL');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "warehouse_movements"');
    await queryRunner.query('DROP TABLE "inventory_stock"');
    await queryRunner.query('DROP TABLE "inventory_items"');
    await queryRunner.query('DROP TABLE "warehouse_locations"');
    await queryRunner.query('DROP INDEX "IDX_orders_warehouseStaffId"');
    await queryRunner.query('ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_warehouseStaff"');
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN "warehouseStaffId"');
    await queryRunner.query('ALTER TABLE "staff" DROP COLUMN "sessionVersion"');
  }
}
