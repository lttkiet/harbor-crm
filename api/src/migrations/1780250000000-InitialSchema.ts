import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1780250000000 implements MigrationInterface {
  name = 'InitialSchema1780250000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "teams" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" character varying(100) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_teams_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_teams_name" UNIQUE ("name")
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "staff" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "email" character varying(180) NOT NULL,
      "role" character varying(32) NOT NULL,
      "firebaseUid" character varying(180),
      "passwordHash" character varying(100),
      "mustChangePassword" boolean NOT NULL DEFAULT false,
      "teamId" uuid,
      "isTeamLead" boolean NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_staff_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_staff_email" UNIQUE ("email"),
      CONSTRAINT "FK_staff_team" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "customers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "type" character varying(20) NOT NULL,
      "name" character varying(180) NOT NULL,
      "contactName" character varying(180),
      "taxId" character varying(40),
      "email" character varying(180),
      "phone" character varying(40),
      "address" text,
      "ownerStaffId" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_customers_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_customers_owner" FOREIGN KEY ("ownerStaffId") REFERENCES "staff"("id") ON DELETE SET NULL
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "orders" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "orderNumber" character varying(20) NOT NULL,
      "type" character varying(20) NOT NULL,
      "status" character varying(30) NOT NULL DEFAULT 'new',
      "customerId" uuid NOT NULL,
      "supplierName" character varying(200),
      "carrierName" character varying(200),
      "trackingNumber" character varying(200),
      "origin" text,
      "destination" text,
      "cargoDescription" text,
      "items" jsonb NOT NULL DEFAULT '[]'::jsonb,
      "customerTotal" numeric(14,2) NOT NULL DEFAULT 0,
      "estimatedCost" numeric(14,2) NOT NULL DEFAULT 0,
      "notes" text,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_orders_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_orders_orderNumber" UNIQUE ("orderNumber"),
      CONSTRAINT "FK_orders_customer" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ledger_entries" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "orderId" uuid NOT NULL,
      "kind" character varying(30) NOT NULL,
      "amount" numeric(14,2) NOT NULL,
      "method" character varying(80),
      "reference" character varying(120),
      "notes" text,
      "occurredOn" date NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_ledger_entries_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_ledger_entries_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS "delivery_updates" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "orderId" uuid NOT NULL,
      "status" character varying(30) NOT NULL,
      "notes" text,
      "updatedBy" character varying(180),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_delivery_updates_id" PRIMARY KEY ("id"),
      CONSTRAINT "FK_delivery_updates_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE
    )`);
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_staff_teamId" ON "staff" ("teamId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_customers_ownerStaffId" ON "customers" ("ownerStaffId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_orders_customerId" ON "orders" ("customerId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_ledger_entries_orderId" ON "ledger_entries" ("orderId")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_delivery_updates_orderId" ON "delivery_updates" ("orderId")');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS "delivery_updates"');
    await queryRunner.query('DROP TABLE IF EXISTS "ledger_entries"');
    await queryRunner.query('DROP TABLE IF EXISTS "orders"');
    await queryRunner.query('DROP TABLE IF EXISTS "customers"');
    await queryRunner.query('DROP TABLE IF EXISTS "staff"');
    await queryRunner.query('DROP TABLE IF EXISTS "teams"');
  }
}
