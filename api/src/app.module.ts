import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Customer } from './entities/customer.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Order } from './entities/order.entity';
import { Staff } from './entities/staff.entity';
import { DeliveryUpdate } from './entities/delivery-update.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { SessionGuard } from './session.guard';
import { Team } from './entities/team.entity';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { WarehouseMovement } from './entities/warehouse-movement.entity';

const authMode = process.env.AUTH_MODE ?? 'dev';
const nodeEnv = process.env.NODE_ENV;
const devJwtSecret = 'local-development-secret-change-before-deploy-please';
const configuredJwtSecret = process.env.JWT_SECRET?.trim();

if (!['dev', 'local', 'firebase'].includes(authMode)) throw new Error('AUTH_MODE must be dev, local, or firebase');
if (authMode === 'dev' && nodeEnv !== 'development') throw new Error('AUTH_MODE=dev is only allowed when NODE_ENV=development');
const appBindAddress = process.env.APP_BIND_ADDRESS?.trim() || '127.0.0.1';
if (authMode === 'dev' && !['127.0.0.1', 'localhost', '::1'].includes(appBindAddress)) throw new Error('AUTH_MODE=dev cannot be exposed beyond loopback; use AUTH_MODE=local or AUTH_MODE=firebase');
if (authMode !== 'dev' && (!configuredJwtSecret || configuredJwtSecret.length < 32 || configuredJwtSecret === devJwtSecret)) {
  throw new Error('Set JWT_SECRET to a unique random value of at least 32 characters outside dev mode');
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({ secret: configuredJwtSecret || devJwtSecret, signOptions: { expiresIn: '12h' } }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Customer, Order, LedgerEntry, Staff, DeliveryUpdate, Team, WarehouseLocation, InventoryItem, InventoryStock, WarehouseMovement],
      synchronize: nodeEnv === 'development',
      migrations: [__dirname + '/migrations/*{.js,.ts}'],
      migrationsRun: nodeEnv !== 'development',
      retryAttempts: 20,
      retryDelay: 2000,
    }),
    TypeOrmModule.forFeature([Customer, Order, LedgerEntry, Staff, DeliveryUpdate, Team]),
  ],
  controllers: [AppController],
  providers: [AppService, SessionGuard],
})
export class AppModule {}
