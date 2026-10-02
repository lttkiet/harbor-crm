import { DataSourceOptions } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { DeliveryUpdate } from './entities/delivery-update.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Order } from './entities/order.entity';
import { Staff } from './entities/staff.entity';
import { Team } from './entities/team.entity';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { WarehouseMovement } from './entities/warehouse-movement.entity';

const entities = [
  Customer,
  Order,
  LedgerEntry,
  Staff,
  DeliveryUpdate,
  Team,
  WarehouseLocation,
  InventoryItem,
  InventoryStock,
  WarehouseMovement,
];

export function getDatabaseOptions(env: NodeJS.ProcessEnv = process.env): DataSourceOptions {
  const cloudSqlInstance = env.CLOUD_SQL_INSTANCE?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  const poolMax = Number(env.DB_POOL_MAX ?? 5);

  if (!Number.isInteger(poolMax) || poolMax < 1 || poolMax > 100) {
    throw new Error('DB_POOL_MAX must be an integer between 1 and 100');
  }

  if (cloudSqlInstance && (!env.DB_USER || !env.DB_PASSWORD || !env.DB_NAME)) {
    throw new Error('Cloud SQL connections require DB_USER, DB_PASSWORD, and DB_NAME');
  }

  if (!cloudSqlInstance && !databaseUrl) {
    throw new Error('Set DATABASE_URL or CLOUD_SQL_INSTANCE and the Cloud SQL database credentials');
  }

  const connection = cloudSqlInstance
    ? {
        host: `/cloudsql/${cloudSqlInstance}`,
        port: 5432,
        username: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
      }
    : { url: databaseUrl };

  return {
    type: 'postgres',
    ...connection,
    entities,
    migrations: [__dirname + '/migrations/*{.js,.ts}'],
    synchronize: env.NODE_ENV === 'development',
    migrationsRun: false,
    extra: { max: poolMax },
  };
}
