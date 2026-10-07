export type Role = 'admin' | 'operations' | 'warehouse' | 'finance';
export type Customer = {
  id: string;
  type: 'business' | 'individual';
  name: string;
  contactName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ownerStaffId?: string | null;
  ownerStaff?: { email: string } | null;
  createdAt: string;
};
export type Order = {
  id: string;
  orderNumber: string;
  type: 'buy' | 'transport';
  status: string;
  customerId: string;
  customer?: Customer;
  supplierName?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  cargoDescription?: string | null;
  items: { name: string; quantity: number; unitCost: number }[];
  customerTotal: string | number;
  billedTotal?: number;
  estimatedCost: string | number;
  notes?: string | null;
  createdAt: string;
  warehouseStaffId?: string | null;
  warehouseAssignee?: Pick<Staff, 'id' | 'email'> | null;
};
export type LedgerEntry = { id: string; kind: string; amount: string | number; method?: string | null; reference?: string | null; notes?: string | null; occurredOn: string };
export type DeliveryUpdate = {
  id: string;
  status: string;
  notes?: string | null;
  updatedBy?: string | null;
  carrierName?: string | null;
  trackingNumber?: string | null;
  origin?: string | null;
  destination?: string | null;
  warehouseStaffId?: string | null;
  createdAt: string;
};
export type OrderDetail = Order & {
  billedTotal: number;
  ledgerEntries: LedgerEntry[];
  deliveryUpdates: DeliveryUpdate[];
  paidByCustomer: number;
  actualCosts: number;
  paidToVendors: number;
  margin: number;
  actualMargin: number;
};
export type FinanceOrder = Order & { billedTotal: number; paidByCustomer: number; actualCosts: number; paidToVendors: number; margin: number; actualMargin: number };
export type Team = { id: string; name: string };
export type Staff = {
  id: string;
  email: string;
  role: Role;
  teamId?: string | null;
  team?: Team | null;
  isTeamLead: boolean;
  firebaseUid?: string | null;
  mustChangePassword?: boolean;
  hasLocalPassword?: boolean;
  createdAt: string;
};
export type WarehouseLocation = { id: string; warehouseName: string; code: string; address?: string | null; createdAt: string };
export type InventoryItem = { id: string; sku: string; name: string; unit: string; reorderLevel: number; createdAt: string };
export type InventoryStock = { id: string; itemId: string; item: InventoryItem; locationId: string; location: WarehouseLocation; quantityOnHand: number; quantityPicked: number; updatedAt: string };
export type WarehouseTask = Omit<
  Pick<
    Order,
    'id' | 'orderNumber' | 'type' | 'status' | 'origin' | 'destination' | 'cargoDescription' | 'items' | 'createdAt' | 'carrierName' | 'trackingNumber' | 'warehouseStaffId' | 'warehouseAssignee'
  >,
  'items'
> & { items: { name: string; quantity: number }[] };
export type WarehouseMovement = {
  id: string;
  type: 'receipt' | 'pick' | 'dispatch';
  itemId: string;
  item: Pick<InventoryItem, 'id' | 'sku' | 'name' | 'unit'>;
  locationId: string;
  location: Pick<WarehouseLocation, 'id' | 'warehouseName' | 'code'>;
  orderId: string | null;
  order?: Pick<Order, 'id' | 'orderNumber' | 'warehouseStaffId'> | null;
  sourceMovementId: string | null;
  quantity: number;
  notes?: string | null;
  performedBy: string;
  createdAt: string;
  pendingDispatch?: boolean;
};
export type WarehouseLookup = { task: WarehouseTask; movements: WarehouseMovement[] };
export type Session = { accessToken: string; user: { id: string; email: string; role: Role; teamId: string | null; isTeamLead: boolean; mustChangePassword?: boolean } };
