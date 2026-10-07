import type {
  Customer,
  DeliveryUpdate,
  FinanceOrder,
  InventoryItem,
  InventoryStock,
  LedgerEntry,
  Order,
  OrderDetail,
  Session,
  Staff,
  Team,
  WarehouseLocation,
  WarehouseLookup,
  WarehouseMovement,
  WarehouseTask,
} from './types';

const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
let token: string | null = null;
export function setApiToken(value: string | null) {
  token = value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new Error('Harbor could not reach the API. Check your connection and try again.');
  }
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? message);
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

export const api = {
  health: () => request<{ status: 'ok' }>('/health'),
  firebaseSession: (idToken: string) => request<Session>('/auth/session', { method: 'POST', body: JSON.stringify({ idToken }) }),
  localSession: (email: string, password: string) => request<import('./types').Session>('/auth/local/session', { method: 'POST', body: JSON.stringify({ email, password }) }),
  currentSession: () => request<{ user: import('./types').Session['user'] }>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) => request<import('./types').Session>('/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  dashboard: () => request<{ customers: number; totalOrders: number; activeOrders: number; readyToShip?: number; inTransit?: number; delivered: number; recentOrders: Order[] }>('/dashboard'),
  customers: (search = '') => request<Customer[]>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  createCustomer: (body: Partial<Customer>) => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(body) }),
  updateCustomer: (id: string, body: Partial<Customer>) => request<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  orders: (filters: { type?: string; status?: string; search?: string } = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value && value !== 'all') as [string, string][]);
    return request<Order[]>(`/orders${params.size ? `?${params}` : ''}`);
  },
  finance: () => request<FinanceOrder[]>('/finance'),
  warehouseAssignees: () => request<Staff[]>('/warehouse/assignees'),
  warehouseTasks: () => request<WarehouseTask[]>('/warehouse/tasks'),
  warehouseLookup: (barcode: string) => request<WarehouseLookup>(`/warehouse/lookup?code=${encodeURIComponent(barcode)}`),
  warehouseLocations: () => request<WarehouseLocation[]>('/warehouse/locations'),
  createWarehouseLocation: (body: Partial<WarehouseLocation>) => request<WarehouseLocation>('/warehouse/locations', { method: 'POST', body: JSON.stringify(body) }),
  warehouseItems: () => request<InventoryItem[]>('/warehouse/items'),
  createInventoryItem: (body: Partial<InventoryItem>) => request<InventoryItem>('/warehouse/items', { method: 'POST', body: JSON.stringify(body) }),
  warehouseStock: () => request<InventoryStock[]>('/warehouse/stock'),
  warehouseMovements: () => request<WarehouseMovement[]>('/warehouse/movements'),
  receiveWarehouseStock: (body: { itemId: string; locationId: string; quantity: number; orderId?: string; notes?: string }) =>
    request<WarehouseMovement>('/warehouse/receipts', { method: 'POST', body: JSON.stringify(body) }),
  pickWarehouseStock: (body: { itemId: string; locationId: string; orderId: string; quantity: number; notes?: string }) =>
    request<WarehouseMovement>('/warehouse/picks', { method: 'POST', body: JSON.stringify(body) }),
  dispatchWarehouseStock: (id: string, body: { notes?: string }) => request<WarehouseMovement>(`/warehouse/movements/${id}/dispatch`, { method: 'POST', body: JSON.stringify(body) }),
  order: (id: string) => request<OrderDetail>(`/orders/${id}`),
  createOrder: (body: Partial<Order>) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(body) }),
  deliveryUpdate: (id: string, body: Partial<DeliveryUpdate>) => request<DeliveryUpdate>(`/orders/${id}/delivery-updates`, { method: 'POST', body: JSON.stringify(body) }),
  ledgerEntry: (id: string, body: Partial<LedgerEntry> & { kind: string; amount: number; occurredOn: string }) =>
    request<LedgerEntry>(`/orders/${id}/ledger`, { method: 'POST', body: JSON.stringify(body) }),
  staff: () => request<Staff[]>('/staff'),
  teams: () => request<Team[]>('/teams'),
  createTeam: (name: string) => request<Team>('/teams', { method: 'POST', body: JSON.stringify({ name }) }),
  createStaff: (body: { email: string; role: string; teamId?: string; isTeamLead: boolean; temporaryPassword?: string }) => request<Staff>('/staff', { method: 'POST', body: JSON.stringify(body) }),
  setTemporaryPassword: (id: string, temporaryPassword: string) => request<Staff>(`/staff/${id}/temporary-password`, { method: 'POST', body: JSON.stringify({ temporaryPassword }) }),
};
