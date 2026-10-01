import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { compare, hash } from 'bcryptjs';
import { ILike, In, Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { DeliveryUpdate } from './entities/delivery-update.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { Order } from './entities/order.entity';
import { Staff, StaffRole } from './entities/staff.entity';
import { Team } from './entities/team.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { WarehouseMovement, WarehouseMovementType } from './entities/warehouse-movement.entity';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(LedgerEntry) private readonly ledger: Repository<LedgerEntry>,
    @InjectRepository(DeliveryUpdate) private readonly updates: Repository<DeliveryUpdate>,
    @InjectRepository(Staff) private readonly staff: Repository<Staff>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    if (process.env.AUTH_MODE !== 'local') return;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) throw new Error('Local auth requires ADMIN_EMAIL');
    let admin = await this.staff.createQueryBuilder('staff').addSelect('staff.passwordHash').where('staff.email = :email', { email }).getOne();
    if (!admin?.passwordHash) {
      const password = process.env.LAN_ADMIN_PASSWORD;
      if (!password || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('Local auth requires a LAN_ADMIN_PASSWORD of 12 to 72 UTF-8 bytes to provision the admin account');
      if (!admin) admin = this.staff.create({ email, role: 'admin', firebaseUid: null, passwordHash: null });
      admin.passwordHash = await hash(password, 12);
      admin.mustChangePassword = true;
      admin.role = 'admin';
      await this.staff.save(admin);
    }
  }

  private session(staff: Staff) {
    const accessToken = this.jwt.sign({ sub: staff.id, email: staff.email, sessionVersion: staff.sessionVersion ?? 0 });
    return { accessToken, user: { id: staff.id, email: staff.email, role: staff.role, teamId: staff.teamId, isTeamLead: staff.isTeamLead, mustChangePassword: staff.mustChangePassword } };
  }

  async localSession(email: string, password: string) {
    if (process.env.AUTH_MODE !== 'local') throw new UnauthorizedException('Local password sign-in is disabled');
    const staff = await this.staff.createQueryBuilder('staff').addSelect('staff.passwordHash').where('LOWER(staff.email) = LOWER(:email)', { email }).getOne();
    if (!staff?.passwordHash || Buffer.byteLength(password, 'utf8') > 72 || !await compare(password, staff.passwordHash)) throw new UnauthorizedException('Invalid email or password');
    return this.session(staff);
  }

  async changePassword(user: any, currentPassword: string, newPassword: string) {
    if (process.env.AUTH_MODE !== 'local') throw new UnauthorizedException('Local password sign-in is disabled');
    if (newPassword.length < 12) throw new ForbiddenException('Password must be at least 12 characters');
    if (Buffer.byteLength(newPassword, 'utf8') > 72) throw new ForbiddenException('Password must be no more than 72 UTF-8 bytes');
    const staff = await this.staff.createQueryBuilder('staff').addSelect('staff.passwordHash').where('staff.id = :id', { id: user.sub }).getOne();
    if (!staff?.passwordHash || !await compare(currentPassword, staff.passwordHash)) throw new UnauthorizedException('Current password is incorrect');
    staff.passwordHash = await hash(newPassword, 12);
    staff.mustChangePassword = false;
    staff.sessionVersion = (staff.sessionVersion ?? 0) + 1;
    await this.staff.save(staff);
    return this.session(staff);
  }

  requireRole(user: any, allowed: string[]) {
    if (!allowed.includes(user.role)) throw new ForbiddenException('Your role cannot perform this action');
  }

  async createSession(idToken: string) {
    if (process.env.AUTH_MODE === 'dev' && process.env.NODE_ENV === 'development') {
      return { accessToken: this.jwt.sign({ sub: 'local-admin', email: 'admin@example.com' }), user: { id: 'local-admin', email: 'admin@example.com', role: 'admin', teamId: null, isTeamLead: false } };
    }
    if (process.env.AUTH_MODE !== 'firebase') throw new UnauthorizedException('Firebase sign-in is disabled');
    try {
      if (!getApps().length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        initializeApp(raw ? { credential: cert(JSON.parse(raw)) } : {});
      }
      const claims = await getAuth().verifyIdToken(idToken);
      if (!claims.email || claims.email_verified !== true) throw new UnauthorizedException('Verify your email before signing in');
      let record = await this.staff.findOne({ where: [{ firebaseUid: claims.uid }, { email: claims.email.toLowerCase() }] });
      if (!record && claims.email.toLowerCase() === process.env.ADMIN_EMAIL?.toLowerCase()) {
        record = await this.staff.save(this.staff.create({ email: claims.email.toLowerCase(), role: 'admin', firebaseUid: claims.uid }));
      }
      if (!record) throw new UnauthorizedException('Ask an administrator to add your staff account');
      if (!record.firebaseUid) {
        record.firebaseUid = claims.uid;
        record = await this.staff.save(record);
      }
      if (record.firebaseUid !== claims.uid) throw new UnauthorizedException('This email is linked to another account');
      return this.session(record);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Firebase sign-in could not be verified');
    }
  }

  private async visibleOwnerIds(user: any): Promise<string[] | null> {
    if (user.role === 'admin') return null;
    const current = await this.staff.findOne({ where: { id: user.sub }, relations: { team: true } });
    if (!current) throw new UnauthorizedException('Staff account is no longer active');
    if (!current.isTeamLead || !current.teamId) return [current.id];
    const members = await this.staff.find({ where: { teamId: current.teamId }, select: { id: true } });
    return members.map((member) => member.id);
  }

  private async canViewCustomer(customer: Customer, user: any): Promise<boolean> {
    if (user.role === 'admin' || customer.ownerStaffId === user.sub) return true;
    if (!user.isTeamLead || !user.teamId || !customer.ownerStaffId) return false;
    const owner = await this.staff.findOneBy({ id: customer.ownerStaffId });
    return owner?.teamId === user.teamId;
  }

  private async withBilledTotals(orders: Order[]) {
    if (!orders.length) return [];
    const charges = await this.ledger.createQueryBuilder('entry')
      .select('entry.orderId', 'orderId')
      .addSelect("COALESCE(SUM(entry.amount), 0)", 'customerCharges')
      .where('entry.kind = :kind', { kind: 'customer_charge' })
      .andWhere('entry.orderId IN (:...orderIds)', { orderIds: orders.map((order) => order.id) })
      .groupBy('entry.orderId')
      .getRawMany<{ orderId: string; customerCharges: string }>();
    const chargesByOrder = new Map(charges.map((row) => [row.orderId, Number(row.customerCharges)]));
    return orders.map((order) => ({ ...order, billedTotal: Number(order.customerTotal) + (chargesByOrder.get(order.id) ?? 0) }));
  }

  private async assertCanManageCustomer(customer: Customer, user: any) {
    if (user.role !== 'admin' && customer.ownerStaffId !== user.sub) throw new NotFoundException('Customer not found');
  }

  private async scopedOrder(id: string, user: any): Promise<Order> {
    const order = await this.orders.findOne({ where: { id }, relations: { customer: true } });
    if (!order || !await this.canViewCustomer(order.customer, user)) throw new NotFoundException('Order not found');
    return order;
  }

  async dashboard(user: any) {
    if (user.role === 'warehouse') {
      const tasks = await this.warehouseTasks(user);
      return {
        customers: 0,
        totalOrders: tasks.length,
        activeOrders: tasks.filter((order) => ['new', 'sourcing', 'ready', 'in_transit'].includes(order.status)).length,
        readyToShip: tasks.filter((order) => order.status === 'ready').length,
        inTransit: tasks.filter((order) => order.status === 'in_transit').length,
        delivered: tasks.filter((order) => order.status === 'delivered').length,
        recentOrders: [],
      };
    }
    const owners = await this.visibleOwnerIds(user);
    const customerQuery = this.customers.createQueryBuilder('customer');
    const orderQuery = this.orders.createQueryBuilder('order').innerJoin('order.customer', 'customer');
    if (owners) {
      customerQuery.where('customer.ownerStaffId IN (:...owners)', { owners });
      orderQuery.where('customer.ownerStaffId IN (:...owners)', { owners });
    }
    const [customers, totalOrders, activeOrders, delivered, orders] = await Promise.all([
      customerQuery.getCount(), orderQuery.clone().getCount(),
      orderQuery.clone().andWhere('order.status IN (:...statuses)', { statuses: ['new', 'sourcing', 'ready', 'in_transit'] }).getCount(),
      orderQuery.clone().andWhere('order.status = :status', { status: 'delivered' }).getCount(),
      orderQuery.clone().leftJoinAndSelect('order.customer', 'orderCustomer').orderBy('order.createdAt', 'DESC').take(8).getMany().then((rows) => this.withBilledTotals(rows)),
    ]);
    return { customers, totalOrders, activeOrders, delivered, recentOrders: orders };
  }

  async listCustomers(search: string | undefined, user: any) {
    const owners = await this.visibleOwnerIds(user);
    const query = this.customers.createQueryBuilder('customer').leftJoin('customer.ownerStaff', 'ownerStaff').addSelect(['ownerStaff.id', 'ownerStaff.email']).orderBy('customer.createdAt', 'DESC');
    if (owners) query.where('customer.ownerStaffId IN (:...owners)', { owners });
    if (search) query.andWhere('(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search)', { search: `%${search}%` });
    return query.getMany();
  }

  async createCustomer(input: Partial<Customer>, user: any) {
    return this.customers.save(this.customers.create({ ...input, contactName: input.type === 'individual' ? null : input.contactName, taxId: input.type === 'individual' ? null : input.taxId, ownerStaffId: user.sub === 'local-admin' ? null : user.sub, email: input.email?.toLowerCase() ?? null }));
  }

  async updateCustomer(id: string, input: Partial<Customer>, user: any) {
    const customer = await this.customers.findOneBy({ id });
    if (!customer) throw new NotFoundException('Customer not found');
    await this.assertCanManageCustomer(customer, user);
    Object.assign(customer, { type: input.type, name: input.name, contactName: input.type === 'individual' ? null : input.contactName, taxId: input.type === 'individual' ? null : input.taxId, email: input.email?.toLowerCase() ?? input.email, phone: input.phone, address: input.address });
    return this.customers.save(customer);
  }

  async listOrders(filters: { type?: string; status?: string; search?: string }, user: any) {
    const owners = await this.visibleOwnerIds(user);
    const query = this.orders.createQueryBuilder('order')
      .leftJoinAndSelect('order.customer', 'customer')
      .leftJoin('order.warehouseAssignee', 'warehouseAssignee')
      .addSelect(['warehouseAssignee.id', 'warehouseAssignee.email'])
      .orderBy('order.createdAt', 'DESC');
    if (owners) query.andWhere('customer.ownerStaffId IN (:...owners)', { owners });
    if (filters.type) query.andWhere('order.type = :type', { type: filters.type });
    if (filters.status) query.andWhere('order.status = :status', { status: filters.status });
    if (filters.search) query.andWhere('(order.orderNumber ILIKE :search OR customer.name ILIKE :search)', { search: `%${filters.search}%` });
    return this.withBilledTotals(await query.getMany());
  }

  async finance(user: any) {
    const owners = await this.visibleOwnerIds(user);
    const ordersQuery = this.orders.createQueryBuilder('order').leftJoinAndSelect('order.customer', 'customer').orderBy('order.createdAt', 'DESC');
    if (owners) ordersQuery.andWhere('customer.ownerStaffId IN (:...owners)', { owners });
    const orders = await ordersQuery.getMany();
    if (!orders.length) return [];
    const ledgerTotals = await this.ledger.createQueryBuilder('entry')
      .select('entry.orderId', 'orderId')
      .addSelect("COALESCE(SUM(CASE WHEN entry.kind = 'customer_charge' THEN entry.amount ELSE 0 END), 0)", 'customerCharges')
      .addSelect("COALESCE(SUM(CASE WHEN entry.kind = 'customer_payment' THEN entry.amount ELSE 0 END), 0)", 'paidByCustomer')
      .addSelect("COALESCE(SUM(CASE WHEN entry.kind IN ('supplier_cost', 'carrier_cost') THEN entry.amount ELSE 0 END), 0)", 'actualCosts')
      .addSelect("COALESCE(SUM(CASE WHEN entry.kind IN ('supplier_payment', 'carrier_payment') THEN entry.amount ELSE 0 END), 0)", 'paidToVendors')
      .where('entry.orderId IN (:...orderIds)', { orderIds: orders.map((order) => order.id) })
      .groupBy('entry.orderId')
      .getRawMany<{ orderId: string; customerCharges: string; paidByCustomer: string; actualCosts: string; paidToVendors: string }>();
    const totalsByOrder = new Map(ledgerTotals.map((row) => [row.orderId, row]));
    return orders.map((order) => {
      const totals = totalsByOrder.get(order.id);
      const billedTotal = Number(order.customerTotal) + Number(totals?.customerCharges ?? 0);
      return {
        ...order,
        billedTotal,
        paidByCustomer: Number(totals?.paidByCustomer ?? 0),
        actualCosts: Number(totals?.actualCosts ?? 0),
        paidToVendors: Number(totals?.paidToVendors ?? 0),
        margin: billedTotal - Number(order.estimatedCost),
        actualMargin: billedTotal - Number(totals?.actualCosts ?? 0),
      };
    });
  }

  async warehouseAssignees(user: any) {
    const query = this.staff.createQueryBuilder('staff').select(['staff.id', 'staff.email', 'staff.teamId']).where('staff.role = :role', { role: 'warehouse' });
    if (user.role === 'operations') {
      const owner = await this.staff.findOneBy({ id: user.sub });
      if (!owner?.teamId) return [];
      query.andWhere('staff.teamId = :teamId', { teamId: owner.teamId });
    }
    return query.orderBy('staff.email', 'ASC').getMany();
  }

  private async warehouseAssigneeIds(user: any) {
    if (user.role === 'admin') return null;
    const ids = [user.sub];
    if (user.isTeamLead && user.teamId) {
      const members = await this.staff.find({ where: { teamId: user.teamId, role: 'warehouse' }, select: { id: true } });
      ids.push(...members.map((member) => member.id));
    }
    return [...new Set(ids)];
  }

  async warehouseTasks(user: any) {
    const assigneeIds = await this.warehouseAssigneeIds(user);
    const query = this.orders.createQueryBuilder('order')
      .leftJoin('order.warehouseAssignee', 'assignee')
      .select(['order.id', 'order.orderNumber', 'order.type', 'order.status', 'order.origin', 'order.destination', 'order.cargoDescription', 'order.items', 'order.carrierName', 'order.trackingNumber', 'order.createdAt', 'order.warehouseStaffId', 'assignee.id', 'assignee.email'])
      .orderBy('order.updatedAt', 'DESC');
    if (assigneeIds) query.where('order.warehouseStaffId IN (:...assigneeIds)', { assigneeIds });
    return (await query.getMany()).map((order) => this.warehouseTaskView(order));
  }

  private warehouseTaskView(order: Order) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      type: order.type,
      status: order.status,
      origin: order.origin,
      destination: order.destination,
      cargoDescription: order.cargoDescription,
      items: (order.items ?? []).map(({ name, quantity }) => ({ name, quantity })),
      carrierName: order.carrierName,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      warehouseStaffId: order.warehouseStaffId,
      warehouseAssignee: order.warehouseAssignee ? { id: order.warehouseAssignee.id, email: order.warehouseAssignee.email } : null,
    };
  }

  async warehouseLookup(code: string, user: any) {
    const orderNumber = typeof code === 'string' ? code.trim().toLowerCase() : '';
    if (!/^(mh|kg)-\d{8}-\d+$/.test(orderNumber)) throw new NotFoundException('Warehouse task not found');
    const order = await this.orders.findOneBy({ orderNumber });
    if (!order) throw new NotFoundException('Warehouse task not found');
    if (user.role !== 'admin') await this.warehouseOrder(order.id, user);

    const repository = this.orders.manager.getRepository(WarehouseMovement);
    const movements = await repository.createQueryBuilder('movement')
      .leftJoin('movement.item', 'item').addSelect(['item.id', 'item.sku', 'item.name', 'item.unit'])
      .leftJoin('movement.location', 'location').addSelect(['location.id', 'location.warehouseName', 'location.code'])
      .where('movement.orderId = :orderId', { orderId: order.id })
      .orderBy('movement.createdAt', 'DESC')
      .take(100)
      .getMany();
    const pickIds = movements.filter((movement) => movement.type === 'pick').map((movement) => movement.id);
    const dispatched = pickIds.length ? await repository.createQueryBuilder('movement')
      .select('movement.sourceMovementId', 'sourceMovementId')
      .where('movement.type = :type', { type: 'dispatch' })
      .andWhere('movement.sourceMovementId IN (:...pickIds)', { pickIds })
      .getRawMany<{ sourceMovementId: string }>() : [];
    const dispatchedPicks = new Set(dispatched.map((movement) => movement.sourceMovementId));

    return {
      task: this.warehouseTaskView(order),
      movements: movements.map((movement) => ({ ...movement, pendingDispatch: movement.type === 'pick' && !dispatchedPicks.has(movement.id) })),
    };
  }

  async warehouseLocations() {
    return this.orders.manager.getRepository(WarehouseLocation).find({ order: { warehouseName: 'ASC', code: 'ASC' } });
  }

  async createWarehouseLocation(input: { warehouseName: string; code: string; address?: string | null }) {
    const repository = this.orders.manager.getRepository(WarehouseLocation);
    const warehouseName = input.warehouseName.trim();
    const code = input.code.trim().toUpperCase();
    if (await repository.findOneBy({ warehouseName, code })) throw new ConflictException('This location code already exists in the warehouse');
    return repository.save(repository.create({ warehouseName, code, address: input.address ?? null }));
  }

  async warehouseItems() {
    return this.orders.manager.getRepository(InventoryItem).find({ order: { sku: 'ASC' } });
  }

  async createInventoryItem(input: { sku: string; name: string; unit?: string; reorderLevel?: number }) {
    const repository = this.orders.manager.getRepository(InventoryItem);
    const sku = input.sku.trim().toUpperCase();
    if (await repository.findOneBy({ sku })) throw new ConflictException('This SKU already exists');
    return repository.save(repository.create({ sku, name: input.name.trim(), unit: input.unit?.trim() || 'each', reorderLevel: input.reorderLevel ?? 0 }));
  }

  async warehouseStock() {
    return this.orders.manager.getRepository(InventoryStock).createQueryBuilder('stock')
      .leftJoinAndSelect('stock.item', 'item')
      .leftJoinAndSelect('stock.location', 'location')
      .orderBy('item.sku', 'ASC').addOrderBy('location.warehouseName', 'ASC').addOrderBy('location.code', 'ASC')
      .getMany();
  }

  async warehouseMovements(user: any) {
    const assigneeIds = await this.warehouseAssigneeIds(user);
    const repository = this.orders.manager.getRepository(WarehouseMovement);
    const query = repository.createQueryBuilder('movement')
      .leftJoin('movement.item', 'item').addSelect(['item.id', 'item.sku', 'item.name', 'item.unit'])
      .leftJoin('movement.location', 'location').addSelect(['location.id', 'location.warehouseName', 'location.code'])
      .leftJoin('movement.order', 'order').addSelect(['order.id', 'order.orderNumber', 'order.warehouseStaffId'])
      .orderBy('movement.createdAt', 'DESC').take(200);
    if (assigneeIds) query.andWhere('(movement.orderId IS NULL OR order.warehouseStaffId IN (:...assigneeIds))', { assigneeIds });
    const rows = await query.getMany();
    const picks = rows.filter((row) => row.type === 'pick').map((row) => row.id);
    const dispatched = picks.length ? await repository.createQueryBuilder('movement')
      .select('movement.sourceMovementId', 'sourceMovementId')
      .where('movement.type = :type', { type: 'dispatch' })
      .andWhere('movement.sourceMovementId IN (:...picks)', { picks })
      .getRawMany<{ sourceMovementId: string }>() : [];
    const dispatchedPicks = new Set(dispatched.map((row) => row.sourceMovementId));
    return rows.map((row) => ({ ...row, pendingDispatch: row.type === 'pick' && !dispatchedPicks.has(row.id) }));
  }

  private async warehouseOrder(id: string, user: any, manage = false) {
    const order = await this.orders.findOneBy({ id });
    if (!order || !order.warehouseStaffId) throw new NotFoundException('Warehouse task not found');
    if (user.role === 'admin' || order.warehouseStaffId === user.sub) return order;
    if (!manage && user.role === 'warehouse' && user.isTeamLead && user.teamId) {
      const assignee = await this.staff.findOneBy({ id: order.warehouseStaffId });
      if (assignee?.teamId === user.teamId) return order;
    }
    throw new NotFoundException('Warehouse task not found');
  }

  private async warehouseItemAndLocation(itemId: string, locationId: string) {
    const [item, location] = await Promise.all([
      this.orders.manager.getRepository(InventoryItem).findOneBy({ id: itemId }),
      this.orders.manager.getRepository(WarehouseLocation).findOneBy({ id: locationId }),
    ]);
    if (!item) throw new NotFoundException('Inventory item not found');
    if (!location) throw new NotFoundException('Warehouse location not found');
    return { item, location };
  }

  async receiveWarehouseStock(input: { itemId: string; locationId: string; quantity: number; orderId?: string; notes?: string | null }, user: any) {
    const { item, location } = await this.warehouseItemAndLocation(input.itemId, input.locationId);
    if (input.orderId) {
      const order = user.role === 'admin' ? await this.orders.findOneBy({ id: input.orderId }) : await this.warehouseOrder(input.orderId, user, true);
      if (!order) throw new NotFoundException('Order not found');
      if (order.type !== 'buy') throw new BadRequestException('Received stock can only be linked to a buy order');
    }
    return this.orders.manager.transaction(async (manager) => {
      await manager.query(`INSERT INTO "inventory_stock" ("itemId", "locationId", "quantityOnHand", "quantityPicked", "updatedAt")
        VALUES ($1, $2, $3, 0, now())
        ON CONFLICT ("itemId", "locationId") DO UPDATE
        SET "quantityOnHand" = "inventory_stock"."quantityOnHand" + EXCLUDED."quantityOnHand", "updatedAt" = now()`, [item.id, location.id, input.quantity]);
      return manager.getRepository(WarehouseMovement).save(manager.getRepository(WarehouseMovement).create({ type: 'receipt', itemId: item.id, locationId: location.id, orderId: input.orderId ?? null, sourceMovementId: null, quantity: input.quantity, notes: input.notes ?? null, performedBy: user.email }));
    });
  }

  async pickWarehouseStock(input: { itemId: string; locationId: string; orderId: string; quantity: number; notes?: string | null }, user: any) {
    const order = user.role === 'admin' ? await this.orders.findOneBy({ id: input.orderId }) : await this.warehouseOrder(input.orderId, user, true);
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'ready') throw new ConflictException('Set the shipment to Ready to ship before picking stock');
    const { item, location } = await this.warehouseItemAndLocation(input.itemId, input.locationId);
    return this.orders.manager.transaction(async (manager) => {
      const repository = manager.getRepository(InventoryStock);
      const stock = await repository.findOne({ where: { itemId: item.id, locationId: location.id }, lock: { mode: 'pessimistic_write' } });
      const available = stock ? stock.quantityOnHand - stock.quantityPicked : 0;
      if (!stock || available < input.quantity) throw new ConflictException(`Only ${available} ${item.unit} available at this location`);
      stock.quantityPicked += input.quantity;
      await repository.save(stock);
      return manager.getRepository(WarehouseMovement).save(manager.getRepository(WarehouseMovement).create({ type: 'pick', itemId: item.id, locationId: location.id, orderId: order.id, sourceMovementId: null, quantity: input.quantity, notes: input.notes ?? null, performedBy: user.email }));
    });
  }

  async dispatchWarehouseStock(pickId: string, input: { notes?: string | null }, user: any) {
    return this.orders.manager.transaction(async (manager) => {
      const movements = manager.getRepository(WarehouseMovement);
      const pick = await movements.findOne({ where: { id: pickId, type: 'pick' }, lock: { mode: 'pessimistic_write' } });
      if (!pick) throw new NotFoundException('Picked stock task not found');
      if (!pick.orderId) throw new NotFoundException('Warehouse task not found');
      if (user.role !== 'admin') await this.warehouseOrder(pick.orderId, user, true);
      const orderRepository = manager.getRepository(Order);
      const order = await orderRepository.findOne({ where: { id: pick.orderId }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Warehouse task not found');
      if (await movements.findOneBy({ type: 'dispatch', sourceMovementId: pick.id })) throw new ConflictException('This pick has already been dispatched');
      const stockRepository = manager.getRepository(InventoryStock);
      const stock = await stockRepository.findOne({ where: { itemId: pick.itemId, locationId: pick.locationId }, lock: { mode: 'pessimistic_write' } });
      if (!stock || stock.quantityPicked < pick.quantity || stock.quantityOnHand < pick.quantity) throw new ConflictException('Picked stock is no longer available');
      stock.quantityPicked -= pick.quantity;
      stock.quantityOnHand -= pick.quantity;
      await stockRepository.save(stock);
      const dispatch = movements.create({ type: 'dispatch' as WarehouseMovementType, itemId: pick.itemId, locationId: pick.locationId, orderId: pick.orderId, sourceMovementId: pick.id, quantity: pick.quantity, notes: input.notes ?? null, performedBy: user.email });
      const savedDispatch = await movements.save(dispatch);
      const orderPicks = await movements.find({ where: { type: 'pick', orderId: order.id }, select: { id: true } });
      const completed = orderPicks.length ? await movements.find({ where: { type: 'dispatch', sourceMovementId: In(orderPicks.map((row) => row.id)) }, select: { sourceMovementId: true } }) : [];
      const dispatchedPickIds = new Set(completed.map((row) => row.sourceMovementId));
      if (order.status === 'ready' && orderPicks.every((row) => dispatchedPickIds.has(row.id))) {
        order.status = 'in_transit';
        await orderRepository.save(order);
        await manager.getRepository(DeliveryUpdate).save(manager.getRepository(DeliveryUpdate).create({ orderId: order.id, status: 'in_transit', notes: 'Warehouse dispatch completed', updatedBy: user.email }));
      }
      return savedDispatch;
    });
  }

  async createOrder(input: any, user: any) {
    const customer = await this.customers.findOneBy({ id: input.customerId });
    if (!customer) throw new NotFoundException('Customer not found');
    await this.assertCanManageCustomer(customer, user);
    const isBuy = input.type === 'buy';
    const dateKey = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' })
      .formatToParts(new Date())
      .filter((part) => part.type === 'day' || part.type === 'month' || part.type === 'year')
      .map((part) => part.value)
      .join('');
    return this.orders.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`crm-order-number:${dateKey}`]);
      const [{ maxNumber }] = await manager.query(
        `SELECT COALESCE(MAX(substring("orderNumber" from '[0-9]+$')::numeric), 0)::text AS "maxNumber"
         FROM "orders"
         WHERE "orderNumber" ~ $1`,
        [`^(mh|kg)-${dateKey}--?[0-9]+$`],
      );
      const nextNumber = (BigInt(maxNumber) + 1n).toString();
      const orderNumber = isBuy ? `mh-${dateKey}-${nextNumber}` : `kg-${dateKey}-${nextNumber}`;
      const order = manager.getRepository(Order).create({ ...input, items: isBuy ? input.items : [], supplierName: isBuy ? input.supplierName : null, cargoDescription: isBuy ? null : input.cargoDescription, customerTotal: String(input.customerTotal ?? 0), estimatedCost: String(input.estimatedCost ?? 0), orderNumber, status: isBuy ? 'sourcing' : 'new' });
      return manager.getRepository(Order).save(order);
    });
  }

  async getOrder(id: string, user: any) {
    await this.scopedOrder(id, user);
    const order = await this.orders.findOne({ where: { id }, relations: { customer: true, ledgerEntries: true, deliveryUpdates: true } });
    if (!order) throw new NotFoundException('Order not found');
    const charges = order.ledgerEntries.filter((entry) => entry.kind === 'customer_charge').reduce((sum, entry) => sum + Number(entry.amount), 0);
    const incoming = order.ledgerEntries.filter((entry) => entry.kind === 'customer_payment').reduce((sum, entry) => sum + Number(entry.amount), 0);
    const outgoing = order.ledgerEntries.filter((entry) => ['supplier_payment', 'carrier_payment'].includes(entry.kind)).reduce((sum, entry) => sum + Number(entry.amount), 0);
    const actualCosts = order.ledgerEntries.filter((entry) => ['supplier_cost', 'carrier_cost'].includes(entry.kind)).reduce((sum, entry) => sum + Number(entry.amount), 0);
    const billedTotal = Number(order.customerTotal) + charges;
    return { ...order, billedTotal, paidByCustomer: incoming, paidToVendors: outgoing, actualCosts, margin: billedTotal - Number(order.estimatedCost), actualMargin: billedTotal - actualCosts };
  }

  async addDeliveryUpdate(id: string, input: any, user: any) {
    let order: Order;
    if (user.role === 'warehouse') {
      if (!['ready', 'in_transit', 'delivered'].includes(input.status)) throw new ForbiddenException('Warehouse staff can only update active shipment statuses');
      order = await this.warehouseOrder(id, user, true);
    }
    else {
      order = await this.scopedOrder(id, user);
      await this.assertCanManageCustomer(order.customer, user);
    }
    if (input.warehouseStaffId !== undefined) {
      if (!['admin', 'operations'].includes(user.role)) throw new ForbiddenException('Only the order owner or administrator can assign warehouse work');
      if (input.warehouseStaffId === null) order.warehouseStaffId = null;
      else {
        const assignee = await this.staff.findOneBy({ id: input.warehouseStaffId });
        if (!assignee || assignee.role !== 'warehouse') throw new NotFoundException('Warehouse staff member not found');
        if (user.role === 'operations') {
          const owner = order.customer.ownerStaffId ? await this.staff.findOneBy({ id: order.customer.ownerStaffId }) : null;
          if (!owner?.teamId || owner.teamId !== assignee.teamId) throw new ForbiddenException('Assign warehouse work to a member of the order owner’s team');
        }
        order.warehouseStaffId = assignee.id;
      }
    }
    const { warehouseStaffId: _warehouseStaffId, ...deliveryInput } = input;
    return this.orders.manager.transaction(async (manager) => {
      const currentOrder = await manager.getRepository(Order).findOneBy({ id });
      if (!currentOrder) throw new NotFoundException('Order not found');
      currentOrder.status = input.status as Order['status'];
      if (input.warehouseStaffId !== undefined) currentOrder.warehouseStaffId = order.warehouseStaffId;
      if (input.carrierName !== undefined) currentOrder.carrierName = input.carrierName;
      if (input.trackingNumber !== undefined) currentOrder.trackingNumber = input.trackingNumber;
      if (input.origin !== undefined) currentOrder.origin = input.origin;
      if (input.destination !== undefined) currentOrder.destination = input.destination;
      await manager.getRepository(Order).save(currentOrder);
      return manager.getRepository(DeliveryUpdate).save(manager.getRepository(DeliveryUpdate).create({ ...deliveryInput, orderId: id, updatedBy: user.email ?? input.updatedBy ?? null }));
    });
  }

  async addLedgerEntry(id: string, input: any, user: any) {
    const order = await this.scopedOrder(id, user);
    await this.assertCanManageCustomer(order.customer, user);
    return this.ledger.save(this.ledger.create({ ...input, amount: String(input.amount), orderId: id }));
  }

  async listStaff() {
    const rows = await this.staff.createQueryBuilder('staff').leftJoinAndSelect('staff.team', 'team').addSelect('staff.passwordHash').orderBy('staff.createdAt', 'DESC').getMany();
    return rows.map((staff) => this.staffResponse(staff));
  }

  private staffResponse(staff: Staff) {
    const { passwordHash, ...record } = staff;
    return { ...record, hasLocalPassword: Boolean(passwordHash) };
  }

  async setTemporaryPassword(id: string, temporaryPassword: string) {
    if (process.env.AUTH_MODE !== 'local') throw new UnauthorizedException('Local password sign-in is disabled');
    if (temporaryPassword.length < 12) throw new ForbiddenException('Temporary password must be at least 12 characters');
    if (Buffer.byteLength(temporaryPassword, 'utf8') > 72) throw new ForbiddenException('Temporary password must be no more than 72 UTF-8 bytes');
    const staff = await this.staff.findOneBy({ id });
    if (!staff) throw new NotFoundException('Staff member not found');
    staff.passwordHash = await hash(temporaryPassword, 12);
    staff.mustChangePassword = true;
    staff.sessionVersion = (staff.sessionVersion ?? 0) + 1;
    return this.staffResponse(await this.staff.save(staff));
  }

  listTeams() { return this.teams.find({ order: { name: 'ASC' } }); }

  async createTeam(name: string) {
    const normalized = name.trim();
    if (!normalized) throw new ForbiddenException('Team name is required');
    if (await this.teams.findOneBy({ name: normalized })) throw new ForbiddenException('Team already exists');
    return this.teams.save(this.teams.create({ name: normalized }));
  }

  async createStaff(input: { email: string; role: Exclude<StaffRole, 'admin'>; teamId?: string; isTeamLead?: boolean; temporaryPassword?: string }) {
    const email = input.email.toLowerCase();
    if (await this.staff.findOneBy({ email })) throw new ForbiddenException('This staff email already exists');
    if (input.isTeamLead && !input.teamId) throw new ForbiddenException('Assign a team before granting team-lead access');
    if (input.teamId && !await this.teams.findOneBy({ id: input.teamId })) throw new NotFoundException('Team not found');
    if (process.env.AUTH_MODE === 'local' && (!input.temporaryPassword || input.temporaryPassword.length < 12 || Buffer.byteLength(input.temporaryPassword, 'utf8') > 72)) throw new ForbiddenException('Temporary password must be 12 to 72 UTF-8 bytes');
    const localPassword = process.env.AUTH_MODE === 'local' ? input.temporaryPassword : undefined;
    const staff = this.staff.create({ email, role: input.role, teamId: input.teamId ?? null, isTeamLead: input.isTeamLead ?? false, firebaseUid: null, passwordHash: localPassword ? await hash(localPassword, 12) : null, mustChangePassword: Boolean(localPassword) });
    return this.staffResponse(await this.staff.save(staff));
  }
}
