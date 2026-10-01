import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { AppService } from './app.service';
import { SessionGuard } from './session.guard';

const trimOptional = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() || null : value;
const trimRequired = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const MAX_VND = 999_999_999_999;

class CustomerInput {
  @IsIn(['business', 'individual']) type: 'business' | 'individual';
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(180) contactName?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(40) taxId?: string;
  @Transform(trimOptional) @IsOptional() @IsEmail() @MaxLength(180) email?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(1000) address?: string;
}

class OrderInput {
  @IsIn(['buy', 'transport']) type: 'buy' | 'transport';
  @IsUUID() customerId: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(200) supplierName?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(200) carrierName?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(200) trackingNumber?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(500) origin?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(500) destination?: string;
  @ValidateIf((order: OrderInput) => order.type === 'transport') @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(2000) cargoDescription?: string;
  @ValidateIf((order: OrderInput) => order.type === 'buy') @IsArray() @ArrayMinSize(1) @IsObject({ each: true }) @ValidateNested({ each: true }) @Type(() => OrderItemInput) items?: OrderItemInput[];
  @IsOptional() @IsInt() @Min(0) @Max(MAX_VND) customerTotal?: number;
  @IsOptional() @IsInt() @Min(0) @Max(MAX_VND) estimatedCost?: number;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

class OrderItemInput {
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) @Max(MAX_VND) unitCost: number;
}

class LedgerInput {
  @IsIn(['customer_charge', 'customer_payment', 'supplier_cost', 'supplier_payment', 'carrier_cost', 'carrier_payment']) kind: 'customer_charge' | 'customer_payment' | 'supplier_cost' | 'supplier_payment' | 'carrier_cost' | 'carrier_payment';
  @IsInt() @Min(1) @Max(MAX_VND) amount: number;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(80) method?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(120) reference?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @IsDateString({ strict: true }) occurredOn: string;
}

class DeliveryInput {
  @IsIn(['new', 'sourcing', 'ready', 'in_transit', 'delivered', 'cancelled']) status: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(200) carrierName?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(200) trackingNumber?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(500) origin?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(500) destination?: string;
  @IsOptional() @IsUUID() warehouseStaffId?: string | null;
}

class WarehouseLocationInput {
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(180) warehouseName: string;
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(60) code: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(1000) address?: string;
}

class InventoryItemInput {
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(80) sku: string;
  @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(180) name: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(30) unit?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000000) reorderLevel?: number;
}

class StockReceiptInput {
  @IsUUID() itemId: string;
  @IsUUID() locationId: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @IsOptional() @IsUUID() orderId?: string;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

class StockPickInput {
  @IsUUID() itemId: string;
  @IsUUID() locationId: string;
  @IsUUID() orderId: string;
  @IsInt() @Min(1) @Max(1000000) quantity: number;
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

class DispatchInput {
  @Transform(trimOptional) @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}

class StaffInput {
  @Transform(trimRequired) @IsEmail() @MaxLength(180) email: string;
  @IsIn(['operations', 'warehouse', 'finance']) role: 'operations' | 'warehouse' | 'finance';
  @IsOptional() @IsUUID() teamId?: string;
  @IsOptional() @IsBoolean() isTeamLead?: boolean;
  @IsOptional() @IsString() @MaxLength(72) temporaryPassword?: string;
}

class TeamInput { @Transform(trimRequired) @IsString() @IsNotEmpty() @MaxLength(100) name: string; }

class SessionInput {
  @IsString() @IsNotEmpty() @MaxLength(5000) idToken: string;
}

class LocalSessionInput {
  @Transform(trimRequired) @IsEmail() @MaxLength(180) email: string;
  @IsString() @MaxLength(72) password: string;
}

class PasswordChangeInput {
  @IsString() @MaxLength(72) currentPassword: string;
  @IsString() @MaxLength(72) newPassword: string;
}

class TemporaryPasswordInput {
  @IsString() @MaxLength(72) temporaryPassword: string;
}

@Controller()
export class AppController {
  constructor(private readonly service: AppService) {}

  @Post('auth/session')
  @HttpCode(200)
  createSession(@Body() body: SessionInput) { return this.service.createSession(body.idToken); }

  @Post('auth/local/session')
  @HttpCode(200)
  localSession(@Body() body: LocalSessionInput) { return this.service.localSession(body.email, body.password); }

  @UseGuards(SessionGuard)
  @Get('auth/me')
  currentSession(@Req() req: any) { return { user: req.user }; }

  @UseGuards(SessionGuard)
  @Post('auth/password')
  changePassword(@Body() body: PasswordChangeInput, @Req() req: any) { return this.service.changePassword(req.user, body.currentPassword, body.newPassword); }

  @Get('health')
  health() { return { status: 'ok' }; }

  @UseGuards(SessionGuard)
  @Get('dashboard')
  dashboard(@Req() req: any) { return this.service.dashboard(req.user); }

  @UseGuards(SessionGuard)
  @Get('customers')
  customers(@Query('search') search: string | undefined, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'finance']);
    return this.service.listCustomers(search, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('customers')
  createCustomer(@Body() body: CustomerInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations']);
    return this.service.createCustomer(body, req.user);
  }

  @UseGuards(SessionGuard)
  @Patch('customers/:id')
  updateCustomer(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: CustomerInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations']);
    return this.service.updateCustomer(id, body, req.user);
  }

  @UseGuards(SessionGuard)
  @Get('orders')
  orders(@Query('type') type: string | undefined, @Query('status') status: string | undefined, @Query('search') search: string | undefined, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'finance']);
    return this.service.listOrders({ type, status, search }, req.user);
  }

  @UseGuards(SessionGuard)
  @Get('finance')
  finance(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'finance']);
    return this.service.finance(req.user);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/assignees')
  warehouseAssignees(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations']);
    return this.service.warehouseAssignees(req.user);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/tasks')
  warehouseTasks(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseTasks(req.user);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/lookup')
  warehouseLookup(@Query('code') code: string, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseLookup(code, req.user);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/locations')
  warehouseLocations(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseLocations();
  }

  @UseGuards(SessionGuard)
  @Post('warehouse/locations')
  createWarehouseLocation(@Body() body: WarehouseLocationInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.createWarehouseLocation(body);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/items')
  warehouseItems(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseItems();
  }

  @UseGuards(SessionGuard)
  @Post('warehouse/items')
  createInventoryItem(@Body() body: InventoryItemInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.createInventoryItem(body);
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/stock')
  warehouseStock(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseStock();
  }

  @UseGuards(SessionGuard)
  @Get('warehouse/movements')
  warehouseMovements(@Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.warehouseMovements(req.user);
  }

  @UseGuards(SessionGuard)
  @Post('warehouse/receipts')
  receiveWarehouseStock(@Body() body: StockReceiptInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.receiveWarehouseStock(body, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('warehouse/picks')
  pickWarehouseStock(@Body() body: StockPickInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.pickWarehouseStock(body, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('warehouse/movements/:id/dispatch')
  dispatchWarehouseStock(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: DispatchInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'warehouse']);
    return this.service.dispatchWarehouseStock(id, body, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('orders')
  createOrder(@Body() body: OrderInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations']);
    return this.service.createOrder(body, req.user);
  }

  @UseGuards(SessionGuard)
  @Get('orders/:id')
  order(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'finance']);
    return this.service.getOrder(id, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('orders/:id/delivery-updates')
  addDeliveryUpdate(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: DeliveryInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'warehouse']);
    return this.service.addDeliveryUpdate(id, body, req.user);
  }

  @UseGuards(SessionGuard)
  @Post('orders/:id/ledger')
  addLedgerEntry(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: LedgerInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin', 'operations', 'finance']);
    return this.service.addLedgerEntry(id, body, req.user);
  }

  @UseGuards(SessionGuard)
  @Get('teams')
  teams(@Req() req: any) {
    this.service.requireRole(req.user, ['admin']);
    return this.service.listTeams();
  }

  @UseGuards(SessionGuard)
  @Post('teams')
  createTeam(@Body() body: TeamInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin']);
    return this.service.createTeam(body.name);
  }

  @UseGuards(SessionGuard)
  @Get('staff')
  staff(@Req() req: any) {
    this.service.requireRole(req.user, ['admin']);
    return this.service.listStaff();
  }

  @UseGuards(SessionGuard)
  @Post('staff')
  createStaff(@Body() body: StaffInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin']);
    return this.service.createStaff(body);
  }

  @UseGuards(SessionGuard)
  @Post('staff/:id/temporary-password')
  setTemporaryPassword(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: TemporaryPasswordInput, @Req() req: any) {
    this.service.requireRole(req.user, ['admin']);
    return this.service.setTemporaryPassword(id, body.temporaryPassword);
  }
}
