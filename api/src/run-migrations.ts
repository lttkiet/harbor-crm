import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { getDatabaseOptions } from './database.config';

async function runMigrations() {
  const dataSource = new DataSource({
    ...getDatabaseOptions(),
    synchronize: false,
    migrationsRun: false,
  });

  try {
    await dataSource.initialize();
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`Applied ${migrations.length} database migration(s).`);
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

void runMigrations().catch((error: unknown) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  console.error(`Database migration failed (${name}). Check database connectivity and migration state.`);
  process.exitCode = 1;
});
