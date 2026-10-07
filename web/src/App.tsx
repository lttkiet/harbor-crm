import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Avatar, Button, Card, Col, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Layout, Menu, Modal, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import { AppstoreOutlined, BankOutlined, BoxPlotOutlined, DashboardOutlined, DatabaseOutlined, EditOutlined, LogoutOutlined, MenuOutlined, PlusOutlined, SearchOutlined, TeamOutlined, TruckOutlined, UserOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { api, setApiToken } from './api';
import { useAuth } from './AuthContext';
import OrderBarcode from './OrderBarcode';
import { setOrderFilter, setPreferenceUser, setSection, type RootState, type WorkspaceSection } from './store';
import Warehouse from './Warehouse';
import type { Customer, FinanceOrder, Order, OrderDetail, Role, Staff, WarehouseTask } from './types';

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;
const VND = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
const MAX_VND = 999_999_999_999;
const money = (value: unknown) => VND.format(Number(value ?? 0));
const formatLedgerDate = (value: string) => { const [year, month, day] = value.slice(0, 10).split('-'); return `${day}/${month}/${year}`; };
const formatVietnamDate = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
const formatVietnamDateTime = (value: string) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
const roleNames: Record<Role, string> = { admin: 'Administrator', operations: 'Operations', warehouse: 'Warehouse', finance: 'Finance' };
const statusNames: Record<string, string> = { new: 'New', sourcing: 'Sourcing', ready: 'Ready to ship', in_transit: 'In transit', delivered: 'Delivered', cancelled: 'Cancelled' };
const statusColors: Record<string, string> = { new: 'default', sourcing: 'processing', ready: 'cyan', in_transit: 'blue', delivered: 'green', cancelled: 'red' };
const statusOptions = Object.entries(statusNames).map(([value, label]) => ({ value, label }));
type Notify = (text: string, kind?: 'success' | 'error') => void;
const errorText = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export default function App() {
  const { user, token, loading, signIn, signOutUser, changePassword } = useAuth();
  const authMode = import.meta.env.VITE_AUTH_MODE ?? 'dev';
  const localDemo = authMode === 'dev';
  const localPasswordMode = authMode === 'local';
  const section = useSelector((state: RootState) => state.preferences.selectedSection);
  const storedOrderFilter = useSelector((state: RootState) => state.preferences.orderFilter);
  const preferenceUserId = useSelector((state: RootState) => state.preferences.userId);
  const orderFilter = ['all', 'buy', 'transport'].includes(storedOrderFilter) ? storedOrderFilter : 'all';
  const dispatch = useDispatch();
  const [messageApi, contextHolder] = message.useMessage();
  const [authError, setAuthError] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [loginForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [loginPasswordType, setLoginPasswordType] = useState('password');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 991px)').matches);
  useEffect(() => { setApiToken(token); }, [token]);
  useEffect(() => {
    const breakpoint = window.matchMedia('(max-width: 991px)');
    const update = () => setIsMobile(breakpoint.matches);
    breakpoint.addEventListener('change', update);
    window.addEventListener('resize', update);
    update();
    return () => { breakpoint.removeEventListener('change', update); window.removeEventListener('resize', update); };
  }, []);
  useEffect(() => {
    if (!user || user.mustChangePassword) { setApiStatus('checking'); return; }
    let active = true;
    const checkApi = () => { void api.health().then(() => { if (active) setApiStatus('online'); }).catch(() => { if (active) setApiStatus('offline'); }); };
    checkApi();
    const timer = window.setInterval(checkApi, 30000);
    window.addEventListener('focus', checkApi);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', checkApi); };
  }, [user?.id, user?.mustChangePassword]);
  const menu = [
    { key: 'overview', icon: <DashboardOutlined />, label: 'Overview' },
    ...(user?.role !== 'warehouse' ? [{ key: 'customers', icon: <TeamOutlined />, label: 'Customers' }, { key: 'orders', icon: <BoxPlotOutlined />, label: 'Orders' }] : []),
    ...(['admin', 'operations', 'warehouse'].includes(user?.role ?? '') ? [{ key: 'logistics', icon: <TruckOutlined />, label: 'Logistics' }] : []),
    ...(['admin', 'operations', 'finance'].includes(user?.role ?? '') ? [{ key: 'finance', icon: <BankOutlined />, label: 'Finance' }] : []),
    ...(['admin', 'warehouse'].includes(user?.role ?? '') ? [{ key: 'warehouse', icon: <DatabaseOutlined />, label: 'Warehouse' }] : []),
    ...(user?.role === 'admin' ? [{ key: 'staff', icon: <UserOutlined />, label: 'Staff access' }] : []),
  ];
  const menuKeys = menu.map(({ key }) => key);
  const activeSection: WorkspaceSection = menuKeys.includes(section) ? section : 'overview';
  const notify: Notify = (text, kind = 'success') => { messageApi[kind](text); };
  async function handleSignOut() {
    setLogoutBusy(true);
    try { await signOutUser(); loginForm.resetFields(); passwordForm.resetFields(); setAuthError(''); }
    catch (error) { notify(errorText(error, 'Could not sign out'), 'error'); }
    finally { setLogoutBusy(false); }
  }
  const selectSection = (key: string) => {
    dispatch(setSection(key as WorkspaceSection));
    setMobileNavOpen(false);
  };
  useEffect(() => {
    if (user && activeSection !== section) dispatch(setSection(activeSection));
  }, [activeSection, dispatch, section, user]);
  useEffect(() => {
    if (user && preferenceUserId !== user.id) dispatch(setPreferenceUser(user.id));
  }, [dispatch, preferenceUserId, user?.id]);
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }, [activeSection, user?.id, user?.mustChangePassword]);
  useEffect(() => {
    if (storedOrderFilter !== orderFilter) dispatch(setOrderFilter(orderFilter));
  }, [dispatch, orderFilter, storedOrderFilter]);

  if (loading) return <div className="loading-screen">Loading your workspace…</div>;
  if (!user) return <main className="login-shell"><Card className="login-card" variant="borderless">
    <div className="brand-mark"><AppstoreOutlined /></div><Text className="eyebrow">{localPasswordMode ? 'LAN PASSWORD SIGN-IN' : 'HARBOR OPERATIONS'}</Text><Title level={2}>{localDemo ? 'Local demo session' : localPasswordMode ? 'LAN staff sign in' : 'Welcome back'}</Title>
    <Text type="secondary">{localDemo ? 'Resume the local administrator workspace. Credentials are not verified in demo mode.' : localPasswordMode ? 'Sign in with the account and temporary password provided by your administrator.' : 'Sign in with your authorized staff account.'}</Text>
    {authError && <Alert className="login-error" type="error" showIcon message={authError} />}
    <Form form={loginForm} layout="vertical" onFinish={async (values) => { setLoginBusy(true); setAuthError(''); try { await signIn(values.email, values.password); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Sign-in failed'); } finally { setLoginBusy(false); } }}>
      {!localDemo && <>
        <Form.Item label="Work email" name="email" rules={[{ required: true, type: 'email', message: 'Enter your work email address' }]}><Input size="large" prefix={<UserOutlined />} placeholder="you@company.com" /></Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, message: 'Enter your password' }]}><Input.Password size="large" visibilityToggle={{ visible: loginPasswordType === 'text', onVisibleChange: (visible) => setLoginPasswordType(visible ? 'text' : 'password') }} placeholder="Your password" /></Form.Item>
      </>}
      <Button type="primary" htmlType="submit" size="large" block loading={loginBusy}>{localDemo ? 'Continue as demo admin' : 'Sign in'}</Button>
    </Form>
    <Text className="login-footnote">Access is managed by your company administrator.</Text>
  </Card></main>;

  if (user.mustChangePassword) return <main className="login-shell"><Card className="login-card" variant="borderless">
    <div className="brand-mark"><AppstoreOutlined /></div><Text className="eyebrow">FIRST SIGN-IN</Text><Title level={2}>Choose a new password</Title>
    <Text type="secondary">Your administrator provided a temporary password. Replace it before using Harbor.</Text>
    {authError && <Alert className="login-error" type="error" showIcon message={authError} />}
    <Form form={passwordForm} layout="vertical" onFinish={async (values) => { setLoginBusy(true); setAuthError(''); try { await changePassword(values.currentPassword, values.newPassword); } catch (error) { setAuthError(error instanceof Error ? error.message : 'Could not update password'); } finally { setLoginBusy(false); } }}>
      <Form.Item label="Temporary password" name="currentPassword" rules={[{ required: true }]}><Input.Password size="large" /></Form.Item>
      <Form.Item label="New password" name="newPassword" rules={[{ required: true, min: 12, max: 72, message: 'Use at least 12 characters and no more than 72 UTF-8 bytes' }, { validator: (_, value) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error('Password must be no more than 72 UTF-8 bytes')) }]}><Input.Password size="large" /></Form.Item>
      <Form.Item label="Confirm new password" name="confirmPassword" dependencies={['newPassword']} rules={[{ required: true, message: 'Confirm your new password' }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('newPassword') === value ? Promise.resolve() : Promise.reject(new Error('Passwords do not match')); } })]}><Input.Password size="large" /></Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loginBusy}>Update password</Button>
    </Form>
    <Button className="password-signout" type="text" block loading={logoutBusy} onClick={() => void handleSignOut()}>Sign out</Button>
  </Card></main>;

  return <Layout className="app-shell">
    {contextHolder}
    {!isMobile && <Sider className="app-sider" width={236} breakpoint="lg" collapsedWidth="0" trigger={null}>
      <div className="brand"><div className="brand-mark"><AppstoreOutlined /></div><div><strong>Harbor</strong><span>OPERATIONS</span></div></div>
      <div className="nav-caption">WORKSPACE</div>
      <Menu theme="light" mode="inline" selectedKeys={[activeSection]} items={menu} onClick={({ key }) => selectSection(key)} />
       <div className="sider-bottom"><div className="server-status" role="status" aria-live="polite"><i className={`status-${apiStatus}`} />{apiStatus === 'online' ? 'API connected' : apiStatus === 'offline' ? 'API unavailable' : 'Checking API'}</div><Text type="secondary">Vietnam · VND</Text></div>
    </Sider>}
    <Layout>
      <Header className="app-header"><Button className="mobile-menu-button" type="text" icon={<MenuOutlined />} onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" /><div className="mobile-brand"><AppstoreOutlined /> Harbor</div><div className="header-spacer" /><Space size={12}><Avatar icon={<UserOutlined />} /><div className="user-label"><Text strong>{user.email}</Text><Text type="secondary">{roleNames[user.role]}</Text></div><Button type="text" icon={<LogoutOutlined />} loading={logoutBusy} onClick={() => void handleSignOut()} aria-label="Sign out" /></Space></Header>
      <Drawer className="mobile-nav" title={<div className="brand"><div className="brand-mark"><AppstoreOutlined /></div><div><strong>Harbor</strong><span>OPERATIONS</span></div></div>} placement="left" open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} width={280} styles={{ body: { padding: 0 } }}>
        <div className="nav-caption">WORKSPACE</div><Menu theme="light" mode="inline" selectedKeys={[activeSection]} items={menu} onClick={({ key }) => selectSection(key)} />
      </Drawer>
      <Content className="app-content">
        {activeSection === 'overview' && <Dashboard role={user.role} onOpenOrder={(order) => { setPendingOrderId(order.id); selectSection('orders'); }} />}
        {activeSection === 'customers' && <Customers user={user} notify={notify} />}
        {activeSection === 'orders' && <Orders user={user} filter={orderFilter} setFilter={(value) => dispatch(setOrderFilter(value))} notify={notify} openOrderId={pendingOrderId} onOrderOpened={() => setPendingOrderId(null)} />}
        {activeSection === 'logistics' && <Logistics user={user} notify={notify} />}
        {activeSection === 'warehouse' && ['admin', 'warehouse'].includes(user.role) && <Warehouse user={user} notify={notify} />}
        {activeSection === 'finance' && <Finance />}
        {activeSection === 'staff' && user.role === 'admin' && <StaffAccess authMode={authMode} notify={notify} />}
      </Content>
    </Layout>
  </Layout>;
}

function PageHeading({ kicker, title, subtitle, action }: { kicker: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><Text className="eyebrow">{kicker}</Text><Title level={2}>{title}</Title><Text type="secondary">{subtitle}</Text></div>{action}</div>;
}

function Dashboard({ role, onOpenOrder }: { role: Role; onOpenOrder: (order: Order) => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.dashboard>> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try { setData(await api.dashboard()); }
    catch (e) { setData(null); setError(errorText(e, 'Could not load the dashboard')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <>
    <PageHeading kicker={role === 'warehouse' ? 'WAREHOUSE AT A GLANCE' : 'OPERATIONS AT A GLANCE'} title="Good morning" subtitle={role === 'warehouse' ? 'A summary of the shipments assigned to you or your team.' : 'Track customer relationships and the latest order activity.'} />
    {error && <Alert className="page-alert" type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Row gutter={[16, 16]} className="metric-row">
      <Col xs={24} sm={12} xl={6}><Metric loading={loading} title={role === 'warehouse' ? 'Assigned tasks' : 'Customers'} value={role === 'warehouse' ? data?.totalOrders : data?.customers} icon={<TeamOutlined />} tone="violet" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric loading={loading} title={role === 'warehouse' ? 'Ready to pick' : 'All orders'} value={role === 'warehouse' ? data?.readyToShip : data?.totalOrders} icon={<BoxPlotOutlined />} tone="blue" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric loading={loading} title={role === 'warehouse' ? 'In transit' : 'In progress'} value={role === 'warehouse' ? data?.inTransit : data?.activeOrders} icon={<TruckOutlined />} tone="amber" /></Col>
      <Col xs={24} sm={12} xl={6}><Metric loading={loading} title="Delivered" value={data?.delivered} icon={<AppstoreOutlined />} tone="green" /></Col>
    </Row>
    {role !== 'warehouse' && <Card className="content-card recent-card" variant="borderless">
      <div className="card-heading"><div><Title level={4}>Recent orders</Title><Text type="secondary">Latest customer activity</Text></div></div>
      <OrderTable rows={data?.recentOrders ?? []} loading={loading} onSelect={onOpenOrder} />
    </Card>}
  </>;
}

function Metric({ title, value, icon, tone, loading = false, format }: { title: string; value?: number; icon: ReactNode; tone: string; loading?: boolean; format?: (value: number) => string }) {
  return <Card className="metric-card" variant="borderless" loading={loading}><div className={`metric-icon ${tone}`}>{icon}</div><Statistic title={title} value={value ?? 0} formatter={value === undefined ? () => '—' : format ? () => format(value) : undefined} /></Card>;
}

function Customers({ user, notify }: { user: { id: string; role: Role }; notify: Notify }) {
  const [rows, setRows] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const loadRequest = useRef(0);
  const [form] = Form.useForm();
  function startCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ type: 'business', name: '', contactName: '', taxId: '', phone: '', email: '', address: '' });
    setOpen(true);
  }
  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true); setLoadError('');
    try { const result = await api.customers(search); if (requestId === loadRequest.current) setRows(result); }
    catch (error) { if (requestId === loadRequest.current) { setRows([]); setLoadError(errorText(error, 'Could not load customers')); } }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadRequest.current += 1; }; }, [search]);
  async function submit(values: any) {
    setBusy(true);
    try { if (editing) { await api.updateCustomer(editing.id, values); notify('Customer updated'); } else { await api.createCustomer(values); notify('Customer added'); } setOpen(false); setEditing(null); form.resetFields(); await load(); }
    catch (error) { notify(errorText(error, 'Could not save customer'), 'error'); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading kicker="CUSTOMER DIRECTORY" title="Customers" subtitle="Your customers and the customers shared with your team." action={['admin', 'operations'].includes(user.role) ? <Button key="new" type="primary" icon={<PlusOutlined />} onClick={startCreate}>Add customer</Button> : undefined} />
    {loadError && <Alert className="page-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Card className="content-card" variant="borderless"><div className="table-toolbar"><Input allowClear prefix={<SearchOutlined />} placeholder="Search name, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      <Table loading={loading} rowKey="id" dataSource={rows} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 780 }} columns={[
        { title: 'Customer', dataIndex: 'name', render: (_, row) => <div className="primary-cell"><Avatar className={row.type === 'business' ? 'avatar-business' : 'avatar-person'} icon={row.type === 'business' ? <BankOutlined /> : <UserOutlined />} /><div><strong>{row.name}</strong><small>{row.contactName || row.email || 'No contact details'}</small></div></div> },
        { title: 'Type', dataIndex: 'type', render: (value) => <Tag color={value === 'business' ? 'geekblue' : 'purple'}>{value === 'business' ? 'Business' : 'Individual'}</Tag> },
        { title: 'Owner', dataIndex: ['ownerStaff', 'email'], render: (value) => value || 'Administrator' },
        { title: 'Phone', dataIndex: 'phone', render: (value) => value || '—' }, { title: 'Email', dataIndex: 'email', render: (value) => value || '—' },
        { title: '', key: 'actions', render: (_, row) => {
          const canEdit = ['admin', 'operations'].includes(user.role) && (user.role === 'admin' || row.ownerStaffId === user.id);
          return <Space size="small"><Button type="text" onClick={() => setViewing(row)}>View</Button>{canEdit && <Button type="text" icon={<EditOutlined />} onClick={() => { setEditing(row); form.setFieldsValue(row); setOpen(true); }}>Edit</Button>}</Space>;
        } },
      ]} />
    </Card>
    <Modal title="Customer details" open={!!viewing} onCancel={() => setViewing(null)} footer={<Button onClick={() => setViewing(null)}>Close</Button>}>
      {viewing && <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label="Name">{viewing.name}</Descriptions.Item>
        <Descriptions.Item label="Type">{viewing.type === 'business' ? 'Business' : 'Individual'}</Descriptions.Item>
        <Descriptions.Item label="Owner">{viewing.ownerStaff?.email ?? 'Administrator'}</Descriptions.Item>
        {viewing.type === 'business' && <>
          <Descriptions.Item label="Contact person">{viewing.contactName || '—'}</Descriptions.Item>
          <Descriptions.Item label="Tax ID">{viewing.taxId || '—'}</Descriptions.Item>
        </>}
        <Descriptions.Item label="Phone">{viewing.phone || '—'}</Descriptions.Item>
        <Descriptions.Item label="Email">{viewing.email || '—'}</Descriptions.Item>
        <Descriptions.Item label="Address">{viewing.address || '—'}</Descriptions.Item>
      </Descriptions>}
    </Modal>
    <Modal title={editing ? 'Edit customer' : 'Add customer'} open={open} onCancel={() => { setOpen(false); setEditing(null); form.resetFields(); }} onOk={() => form.submit()} okText={editing ? 'Save changes' : 'Save customer'} confirmLoading={busy}>
      <Form form={form} layout="vertical" onFinish={submit} initialValues={editing ?? { type: 'business' }}>
        <Form.Item label="Customer type" name="type" rules={[{ required: true, message: 'Choose a customer type' }]}><Select options={[{ value: 'business', label: 'Business' }, { value: 'individual', label: 'Individual' }]} /></Form.Item>
        <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>{({ getFieldValue }) => <>
        <Form.Item label={getFieldValue('type') === 'business' ? 'Business name' : 'Full name'} name="name" rules={[{ required: true, whitespace: true, message: 'Enter a customer name' }]}><Input maxLength={180} placeholder="Customer name" /></Form.Item>
          {getFieldValue('type') === 'business' && <><Form.Item label="Contact person" name="contactName" preserve={false}><Input maxLength={180} /></Form.Item><Form.Item label="Tax ID" name="taxId" preserve={false}><Input maxLength={40} /></Form.Item></>}
        </>}</Form.Item>
         <Row gutter={12}><Col xs={24} sm={12}><Form.Item label="Phone" name="phone"><Input maxLength={40} placeholder="+84" /></Form.Item></Col><Col xs={24} sm={12}><Form.Item label="Email" name="email" rules={[{ validator: (_, value) => !value?.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? Promise.resolve() : Promise.reject(new Error('Enter a valid email address')) }]}><Input maxLength={180} /></Form.Item></Col></Row>
        <Form.Item label="Address" name="address"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>
  </>;
}

function OrderTable({ rows, onSelect, loading = false }: { rows: Order[]; onSelect: (order: Order) => void; loading?: boolean }) {
  return <Table loading={loading} rowKey="id" dataSource={rows} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 560 }} onRow={(record) => ({ onClick: () => onSelect(record), className: 'clickable-row' })} columns={[
    { title: 'Order', dataIndex: 'orderNumber', render: (value, row) => <Button type="link" className="order-open" aria-label={`Open order ${value}`} onClick={(event) => { event.stopPropagation(); onSelect(row); }}><span className="order-id"><strong>{value}</strong><small>{row.type === 'buy' ? 'Buy order' : 'Transport order'}</small></span></Button> },
    { title: 'Customer', dataIndex: ['customer', 'name'], render: (value) => value || '—' },
    { title: 'Status', dataIndex: 'status', render: (value) => <Tag color={statusColors[value]}>{statusNames[value] ?? value}</Tag> },
    { title: 'Customer total', dataIndex: 'billedTotal', align: 'right' as const, render: (value, row) => money(value ?? row.customerTotal) },
  ]} />;
}

function Orders({ user, filter, setFilter, notify, openOrderId, onOrderOpened }: { user: { id: string; role: Role }; filter: 'all' | 'buy' | 'transport'; setFilter: (value: 'all' | 'buy' | 'transport') => void; notify: Notify; openOrderId: string | null; onOrderOpened: () => void }) {
  const role = user.role;
  const [rows, setRows] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customerError, setCustomerError] = useState('');
  const loadRequest = useRef(0);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const selectableCustomers = role === 'admin' ? customers : customers.filter((customer) => customer.ownerStaffId === user.id);
  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true); setLoadError('');
    try { const result = await api.orders({ search, type: filter }); if (requestId === loadRequest.current) setRows(result); }
    catch (error) { if (requestId === loadRequest.current) { setRows([]); setLoadError(errorText(error, 'Could not load orders')); } }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadRequest.current += 1; }; }, [search, filter]);
  async function loadCustomers() {
    setCustomersLoading(true); setCustomerError('');
    try { setCustomers(await api.customers()); }
    catch (error) { setCustomers([]); setCustomerError(errorText(error, 'Could not load customers')); }
    finally { setCustomersLoading(false); }
  }
  useEffect(() => { void loadCustomers(); }, []);
  useEffect(() => {
    if (!openOrderId) return;
    api.order(openOrderId).then(setSelected).catch((error) => notify(errorText(error, 'Could not load order'), 'error')).finally(onOrderOpened);
  }, [openOrderId]);
  async function openOrder(order: Order) { try { setSelected(await api.order(order.id)); } catch (error) { notify(errorText(error, 'Could not load order'), 'error'); } }
  async function submit(values: any) {
    setBusy(true);
    try {
      const items = values.itemName ? [{ name: values.itemName, quantity: Number(values.quantity ?? 1), unitCost: Number(values.unitCost ?? 0) }] : [];
      await api.createOrder({ ...values, items: values.type === 'buy' ? items : [], supplierName: values.type === 'buy' ? values.supplierName : undefined, cargoDescription: values.type === 'transport' ? values.cargoDescription : undefined, customerTotal: Number(values.customerTotal ?? 0), estimatedCost: Number(values.estimatedCost ?? 0) });
      setCreateOpen(false); form.resetFields(); notify('Order created'); await load();
    } catch (error) { notify(errorText(error, 'Could not save order'), 'error'); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading kicker="CUSTOMER WORK" title="Orders" subtitle="Create and follow sourcing and transport work." action={['admin', 'operations'].includes(role) ? <Button key="new" type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>New order</Button> : undefined} />
    {loadError && <Alert className="page-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Card className="content-card" variant="borderless"><div className="table-toolbar"><Input allowClear prefix={<SearchOutlined />} placeholder="Search order or customer" value={search} onChange={(e) => setSearch(e.target.value)} /><Select value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All types' }, { value: 'buy', label: 'Buy orders' }, { value: 'transport', label: 'Transport orders' }]} /></div><OrderTable rows={rows} loading={loading} onSelect={openOrder} /></Card>
    <Modal title="Create order" open={createOpen} onCancel={() => { setCreateOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="Create order" confirmLoading={busy} width={680}>
      {customerError && <Alert className="form-alert" type="error" showIcon message={customerError} action={<Button size="small" onClick={() => void loadCustomers()}>Try again</Button>} />}
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ type: 'buy', quantity: 1, customerTotal: 0, estimatedCost: 0 }}>
        <Row gutter={16}><Col xs={24} sm={12}><Form.Item label="Order type" name="type" rules={[{ required: true, message: 'Choose an order type' }]}><Select options={[{ value: 'buy', label: 'Buy · source goods and arrange delivery' }, { value: 'transport', label: 'Transport · move customer-owned goods' }]} /></Form.Item></Col><Col xs={24} sm={12}><Form.Item label="Customer" name="customerId" rules={[{ required: true, message: 'Select a customer' }]}><Select loading={customersLoading} disabled={customersLoading || !!customerError} showSearch optionFilterProp="label" options={selectableCustomers.map((customer) => ({ value: customer.id, label: customer.name }))} placeholder="Select a customer" /></Form.Item></Col></Row>
        <Form.Item noStyle shouldUpdate={(a, b) => a.type !== b.type}>{({ getFieldValue }) => <>
          {getFieldValue('type') === 'buy' && <Row gutter={16}><Col span={16}><Form.Item label="Item to source" name="itemName" preserve={false} rules={[{ required: true, whitespace: true, message: 'Describe the item to source' }]}><Input maxLength={180} placeholder="Product or goods" /></Form.Item></Col><Col span={8}><Form.Item label="Quantity" name="quantity" preserve={false} rules={[{ required: true, message: 'Enter a quantity' }]}><InputNumber min={1} precision={0} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item label="Supplier" name="supplierName" preserve={false}><Input maxLength={200} /></Form.Item></Col><Col span={12}><Form.Item label="Unit cost" name="unitCost" preserve={false}><InputNumber min={0} max={MAX_VND} precision={0} className="full-width" /></Form.Item></Col></Row>}
          {getFieldValue('type') === 'transport' && <Form.Item label="Cargo description" name="cargoDescription" preserve={false} rules={[{ required: true, whitespace: true, message: 'Describe the cargo to transport' }]}><Input maxLength={2000} placeholder="What needs to be transported?" /></Form.Item>}
        </>}</Form.Item>
        <Row gutter={16}><Col span={12}><Form.Item label="Origin" name="origin"><Input maxLength={500} /></Form.Item></Col><Col span={12}><Form.Item label="Destination" name="destination"><Input maxLength={500} /></Form.Item></Col><Col span={12}><Form.Item label="Customer total (VND)" name="customerTotal"><InputNumber min={0} max={MAX_VND} precision={0} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item label="Estimated order cost (VND)" name="estimatedCost"><InputNumber min={0} max={MAX_VND} precision={0} className="full-width" /></Form.Item></Col></Row>
        <Form.Item label="Notes" name="notes"><Input.TextArea rows={2} maxLength={5000} /></Form.Item>
      </Form>
    </Modal>
    <OrderDrawer order={selected} role={role} userId={user.id} onClose={() => setSelected(null)} onChanged={async () => { await load(); if (selected) setSelected(await api.order(selected.id)); }} notify={notify} />
  </>;
}

function Logistics({ user, notify }: { user: { id: string; role: Role }; notify: Notify }) {
  const [rows, setRows] = useState<Array<Order | WarehouseTask>>([]);
  const [assignees, setAssignees] = useState<Staff[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<OrderDetail | null>(null);
  const [updating, setUpdating] = useState<Order | WarehouseTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadRequest = useRef(0);
  const [form] = Form.useForm();
  const editableRole = ['admin', 'operations', 'warehouse'].includes(user.role);
  async function load() {
    const requestId = ++loadRequest.current;
    setLoading(true); setLoadError('');
    try {
      const result = user.role === 'warehouse' ? await api.warehouseTasks() : await api.orders({ search });
      const filtered = user.role === 'warehouse' && search.trim()
        ? result.filter((row) => [row.orderNumber, row.origin, row.destination, row.cargoDescription, ...row.items.map((item) => item.name)].some((value) => value?.toLowerCase().includes(search.trim().toLowerCase())))
        : result;
      if (requestId === loadRequest.current) setRows(filtered);
    }
    catch (error) { if (requestId === loadRequest.current) { setRows([]); setLoadError(errorText(error, 'Could not load shipments')); } }
    finally { if (requestId === loadRequest.current) setLoading(false); }
  }
  useEffect(() => { void load(); return () => { loadRequest.current += 1; }; }, [search]);
  useEffect(() => {
    if (!['admin', 'operations'].includes(user.role)) return;
    api.warehouseAssignees().then(setAssignees).catch((error) => notify(errorText(error, 'Could not load warehouse staff'), 'error'));
  }, [user.role]);
    // ⚡ Bolt: Memoize filtered rows to prevent unnecessary recalculation on render
  const visibleRows = useMemo(() => status === 'all' ? rows : rows.filter((row) => row.status === status), [status, rows]);
    // ⚡ Bolt: Memoize status counts to prevent unnecessary array iterations on render
  const readyCount = useMemo(() => rows.filter((row) => row.status === 'ready').length, [rows]);
  const transitCount = useMemo(() => rows.filter((row) => row.status === 'in_transit').length, [rows]);
  const deliveredCount = useMemo(() => rows.filter((row) => row.status === 'delivered').length, [rows]);

  async function openDetails(row: Order | WarehouseTask) {
    if (user.role === 'warehouse') return;
    try { setSelected(await api.order(row.id)); }
    catch (error) { notify(errorText(error, 'Could not load shipment'), 'error'); }
  }
  function openUpdate(row: Order | WarehouseTask) {
    form.resetFields();
    setUpdating(row);
    form.setFieldsValue({ status: row.status, carrierName: row.carrierName, trackingNumber: row.trackingNumber, origin: row.origin, destination: row.destination, warehouseStaffId: row.warehouseStaffId ?? undefined, notes: '' });
  }
  async function saveUpdate(values: any) {
    if (!updating) return;
    setBusy(true);
    try {
      const body = { ...values, ...(user.role === 'admin' || user.role === 'operations' ? { warehouseStaffId: values.warehouseStaffId ?? null } : {}) };
      await api.deliveryUpdate(updating.id, body);
    } catch (error) { notify(errorText(error, 'Could not update shipment'), 'error'); return; }
    finally { setBusy(false); }
    setUpdating(null); form.resetFields(); notify('Shipment details updated'); await load();
    if (selected?.id === updating.id) {
      try { setSelected(await api.order(updating.id)); }
      catch { notify('Shipment updated, but its details could not be refreshed.', 'error'); }
    }
  }

  return <>
    <PageHeading kicker={user.role === 'warehouse' ? 'ASSIGNED SHIPMENTS' : 'SHIPMENT TRACKING'} title="Logistics" subtitle={user.role === 'warehouse' ? 'See team assignments and update shipment details for work assigned to you.' : 'Track shipments, assign warehouse work, and keep delivery status current.'} />
    <Row gutter={[16, 16]} className="metric-row logistics-metrics">
      <Col xs={24} sm={8}><Metric loading={loading} title="Ready to ship" value={loadError ? undefined : readyCount} icon={<BoxPlotOutlined />} tone="amber" /></Col>
      <Col xs={24} sm={8}><Metric loading={loading} title="In transit" value={loadError ? undefined : transitCount} icon={<TruckOutlined />} tone="blue" /></Col>
      <Col xs={24} sm={8}><Metric loading={loading} title="Delivered" value={loadError ? undefined : deliveredCount} icon={<AppstoreOutlined />} tone="green" /></Col>
    </Row>
    {loadError && <Alert className="page-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Card className="content-card logistics-card" variant="borderless">
      <div className="logistics-toolbar">
        <Input allowClear prefix={<SearchOutlined />} placeholder={user.role === 'warehouse' ? 'Search order or cargo' : 'Search order or customer'} value={search} onChange={(event) => setSearch(event.target.value)} />
        <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'All shipments' }, ...statusOptions.filter((option) => option.value !== 'cancelled')]} />
      </div>
      <Table loading={loading} rowKey="id" dataSource={visibleRows} pagination={{ pageSize: 8, showSizeChanger: false }} scroll={{ x: 850 }} onRow={(record) => user.role === 'warehouse' ? {} : ({ onClick: () => void openDetails(record), className: 'clickable-row' })} columns={[
        { title: 'Shipment', dataIndex: 'orderNumber', width: 145, render: (value, row) => user.role === 'warehouse' ? <span className="order-id"><strong>{value}</strong><small>{row.type === 'buy' ? 'Buy order' : 'Transport order'}</small></span> : <Button type="link" className="order-open" aria-label={`Open shipment ${value}`} onClick={(event) => { event.stopPropagation(); void openDetails(row); }}><span className="order-id"><strong>{value}</strong><small>{row.type === 'buy' ? 'Buy order' : 'Transport order'}</small></span></Button> },
        ...(user.role === 'warehouse' ? [] : [{ title: 'Customer', dataIndex: ['customer', 'name'], width: 165, render: (_: unknown, row: Order | WarehouseTask) => ('customer' in row ? row.customer?.name : null) || '—' }]),
        { title: 'Route / cargo', width: 230, render: (_, row) => <div className="shipment-route"><strong>{row.origin || 'Origin pending'} <span>→</span> {row.destination || 'Destination pending'}</strong><small>{row.cargoDescription || row.items?.map((item) => item.name).join(', ') || 'Cargo details pending'}</small></div> },
        { title: 'Carrier / tracking', width: 180, render: (_, row) => <div className="shipment-route"><strong>{row.carrierName || 'Carrier not assigned'}</strong><small>{row.trackingNumber || 'Tracking number pending'}</small></div> },
        ...(user.role === 'admin' || user.role === 'operations' ? [{ title: 'Warehouse task', width: 160, render: (_: unknown, row: Order | WarehouseTask) => row.warehouseAssignee?.email ?? 'Not assigned' }] : []),
        { title: 'Status', dataIndex: 'status', width: 135, render: (value) => <Tag color={statusColors[value]}>{statusNames[value] ?? value}</Tag> },
        { title: '', key: 'actions', width: 125, render: (_, row) => {
          const canUpdate = user.role === 'warehouse'
            ? row.warehouseStaffId === user.id
            : editableRole && (user.role === 'admin' || ('customer' in row && row.customer?.ownerStaffId === user.id));
          return canUpdate
            ? <Button size="small" type="primary" ghost onClick={(event) => { event.stopPropagation(); openUpdate(row); }}>Update shipment</Button>
            : <Text type="secondary">{user.role === 'warehouse' && row.warehouseStaffId !== user.id ? 'Team task · view only' : 'View only'}</Text>;
        } },
      ]} />
    </Card>
    <Modal title={`Update shipment${updating ? ` · ${updating.orderNumber}` : ''}`} open={!!updating} onCancel={() => { setUpdating(null); form.resetFields(); }} onOk={() => form.submit()} okText="Save update" confirmLoading={busy} width={620}>
      <Form form={form} layout="vertical" onFinish={saveUpdate}>
        <Row gutter={14}><Col span={12}><Form.Item label="Delivery status" name="status" rules={[{ required: true, message: 'Choose a delivery status' }]}><Select options={user.role === 'warehouse' ? statusOptions.filter((option) => ['ready', 'in_transit', 'delivered'].includes(option.value)) : statusOptions} /></Form.Item></Col><Col span={12}><Form.Item label="Carrier" name="carrierName"><Input maxLength={200} placeholder="Carrier or delivery partner" /></Form.Item></Col></Row>
        {(user.role === 'admin' || user.role === 'operations') && <Form.Item label="Assign warehouse staff" name="warehouseStaffId"><Select allowClear showSearch optionFilterProp="label" options={assignees.map((staff) => ({ value: staff.id, label: staff.email }))} placeholder="Leave unassigned" /></Form.Item>}
        <Form.Item label="Tracking number" name="trackingNumber"><Input maxLength={200} placeholder="Shipment reference" /></Form.Item>
        <Row gutter={14}><Col span={12}><Form.Item label="Origin" name="origin"><Input maxLength={500} /></Form.Item></Col><Col span={12}><Form.Item label="Destination" name="destination"><Input maxLength={500} /></Form.Item></Col></Row>
        <Form.Item label="Warehouse update" name="notes"><Input.TextArea rows={3} maxLength={5000} placeholder="Packing, pickup, handoff, or delivery note" /></Form.Item>
      </Form>
    </Modal>
    <OrderDrawer order={selected} role={user.role} userId={user.id} onClose={() => setSelected(null)} onChanged={async () => { await load(); if (selected) setSelected(await api.order(selected.id)); }} notify={notify} />
  </>;
}

function OrderDrawer({ order, role, userId, onClose, onChanged, notify }: { order: OrderDetail | null; role: Role; userId: string; onClose: () => void; onChanged: () => Promise<void>; notify: Notify }) {
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [ledgerForm] = Form.useForm();
  const [deliveryForm] = Form.useForm();
  const canManage = role === 'admin' || order?.customer?.ownerStaffId === userId;
  const canManageLedger = canManage && ['admin', 'operations', 'finance'].includes(role);
  const isWarehouse = canManage && ['admin', 'operations', 'warehouse'].includes(role);
  async function addLedger(values: any) {
    if (!order || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      try { await api.ledgerEntry(order.id, { ...values, amount: Number(values.amount), occurredOn: values.occurredOn.format('YYYY-MM-DD') }); }
      catch (error) { notify(errorText(error, 'Could not record entry'), 'error'); return; }
      setLedgerOpen(false); ledgerForm.resetFields(); notify('Ledger entry recorded');
      try { await onChanged(); }
      catch { notify('Entry recorded, but the order details could not be refreshed.', 'error'); }
    } finally { savingRef.current = false; setSaving(false); }
  }
  async function addDelivery(values: any) {
    if (!order || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      try { await api.deliveryUpdate(order.id, values); }
      catch (error) { notify(errorText(error, 'Could not save delivery update'), 'error'); return; }
      setDeliveryOpen(false); deliveryForm.resetFields(); notify('Delivery update saved');
      try { await onChanged(); }
      catch { notify('Delivery update saved, but the order details could not be refreshed.', 'error'); }
    } finally { savingRef.current = false; setSaving(false); }
  }
  const ledgerLabels: Record<string, string> = { customer_charge: 'Customer charge', customer_payment: 'Customer payment', supplier_cost: 'Supplier cost', supplier_payment: 'Supplier payment', carrier_cost: 'Carrier cost', carrier_payment: 'Carrier payment' };
  return <Drawer width="min(600px, 100vw)" open={!!order} onClose={onClose} title={order?.orderNumber} extra={order && <Tag color={statusColors[order.status]}>{statusNames[order.status]}</Tag>}>
    {order && <div className="order-detail">
      <div className="detail-customer"><Text className="eyebrow">{order.type === 'buy' ? 'BUY ORDER' : 'TRANSPORT ORDER'}</Text><Title level={4}>{order.customer?.name}</Title><Text type="secondary">Created {formatVietnamDate(order.createdAt)}</Text></div>
      <OrderBarcode orderNumber={order.orderNumber} type={order.type} />
      <Row gutter={12}><Col xs={24} sm={8}><Card className="detail-stat"><Text type="secondary">Customer total</Text><strong>{money(order.billedTotal)}</strong></Card></Col><Col xs={24} sm={8}><Card className="detail-stat"><Text type="secondary">Received</Text><strong>{money(order.paidByCustomer)}</strong></Card></Col><Col xs={24} sm={8}><Card className="detail-stat"><Text type="secondary">Est. margin</Text><strong>{money(order.margin)}</strong></Card></Col></Row>
      <Descriptions column={1} size="small" bordered className="detail-descriptions">
        {order.supplierName && <Descriptions.Item label="Supplier">{order.supplierName}</Descriptions.Item>}
        {order.items?.length > 0 && <Descriptions.Item label="Items">{order.items.map((item, i) => <div key={i}>{item.name} × {item.quantity} · {money(item.unitCost)} each</div>)}</Descriptions.Item>}
        {order.cargoDescription && <Descriptions.Item label="Cargo">{order.cargoDescription}</Descriptions.Item>}
        {order.origin && <Descriptions.Item label="Origin">{order.origin}</Descriptions.Item>}{order.destination && <Descriptions.Item label="Destination">{order.destination}</Descriptions.Item>}
        {order.carrierName && <Descriptions.Item label="Carrier">{order.carrierName}</Descriptions.Item>}{order.trackingNumber && <Descriptions.Item label="Tracking">{order.trackingNumber}</Descriptions.Item>}
        {order.notes && <Descriptions.Item label="Notes">{order.notes}</Descriptions.Item>}
      </Descriptions>
      <div className="detail-section-heading"><Title level={5}>Delivery updates</Title>{isWarehouse && <Button size="small" onClick={() => setDeliveryOpen(true)}>Update status</Button>}</div>
      {!order.deliveryUpdates?.length ? <Text type="secondary">No updates recorded yet.</Text> : <div className="timeline-list">{[...order.deliveryUpdates].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).map((update) => <div className="timeline-item" key={update.id}><span className="timeline-dot" /><div><strong>{statusNames[update.status] ?? update.status}</strong><small>{update.notes || 'Status changed'} · {formatVietnamDateTime(update.createdAt)}</small></div></div>)}</div>}
      <div className="detail-section-heading"><Title level={5}>Money ledger</Title>{canManageLedger && <Button size="small" onClick={() => setLedgerOpen(true)}>Add entry</Button>}</div>
      {!order.ledgerEntries?.length ? <Text type="secondary">No charges or payments recorded yet.</Text> : <Table size="small" pagination={false} rowKey="id" dataSource={order.ledgerEntries} scroll={{ x: 460 }} columns={[{ title: 'Entry', dataIndex: 'kind', render: (value) => ledgerLabels[value] ?? value }, { title: 'Date', dataIndex: 'occurredOn', render: formatLedgerDate }, { title: 'Amount', dataIndex: 'amount', align: 'right' as const, render: money }]} />}
      <Modal title="Record ledger entry" open={ledgerOpen} onCancel={() => { if (!saving) setLedgerOpen(false); }} onOk={() => ledgerForm.submit()} okText="Save entry" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} maskClosable={!saving}>
        <Form form={ledgerForm} layout="vertical" onFinish={addLedger} initialValues={{ occurredOn: null }}>
          <Form.Item label="Entry type" name="kind" rules={[{ required: true, message: 'Choose an entry type' }]}><Select options={Object.entries(ledgerLabels).map(([value, label]) => ({ value, label }))} /></Form.Item>
          <Row gutter={12}><Col span={12}><Form.Item label="Amount (VND)" name="amount" rules={[{ required: true, message: 'Enter an amount' }]}><InputNumber min={1} max={MAX_VND} precision={0} className="full-width" /></Form.Item></Col><Col span={12}><Form.Item label="Date" name="occurredOn" rules={[{ required: true, message: 'Choose a date' }]}><DatePicker format="DD/MM/YYYY" className="full-width" /></Form.Item></Col></Row>
          <Form.Item label="Method" name="method"><Input maxLength={80} placeholder="Bank transfer, cash…" /></Form.Item><Form.Item label="Reference" name="reference"><Input maxLength={120} /></Form.Item><Form.Item label="Notes" name="notes"><Input.TextArea rows={2} maxLength={5000} /></Form.Item>
        </Form>
      </Modal>
      <Modal title="Update delivery status" open={deliveryOpen} onCancel={() => { if (!saving) setDeliveryOpen(false); }} onOk={() => deliveryForm.submit()} okText="Save update" confirmLoading={saving} cancelButtonProps={{ disabled: saving }} maskClosable={!saving}>
        <Form form={deliveryForm} layout="vertical" onFinish={addDelivery} initialValues={{ status: order.status }}><Form.Item label="Status" name="status" rules={[{ required: true }]}><Select options={statusOptions} /></Form.Item><Form.Item label="Update note" name="notes"><Input.TextArea rows={3} placeholder="Location, handoff, or delivery details" /></Form.Item></Form>
      </Modal>
    </div>}
  </Drawer>;
}

function Finance() {
  const [rows, setRows] = useState<FinanceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  async function load() {
    setLoading(true); setLoadError('');
    try { setRows(await api.finance()); }
    catch (error) { setRows([]); setLoadError(errorText(error, 'Could not load finance data')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  const totals = useMemo(() => rows.reduce((acc, row) => ({ billed: acc.billed + row.billedTotal, received: acc.received + row.paidByCustomer, paidToVendors: acc.paidToVendors + row.paidToVendors, estimatedCosts: acc.estimatedCosts + Number(row.estimatedCost) }), { billed: 0, received: 0, paidToVendors: 0, estimatedCosts: 0 }), [rows]);
  return <><PageHeading kicker="MONEY MOVEMENT" title="Finance" subtitle="Review customer balances, supplier payouts, and recorded costs." />
    {loadError && <Alert className="page-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Row gutter={[16, 16]} className="metric-row"><Col xs={24} sm={12} xl={6}><Metric loading={loading} title="Customer charges" value={loadError ? undefined : totals.billed} format={money} icon={<BankOutlined />} tone="violet" /></Col><Col xs={24} sm={12} xl={6}><Metric loading={loading} title="Payments received" value={loadError ? undefined : totals.received} format={money} icon={<BankOutlined />} tone="green" /></Col><Col xs={24} sm={12} xl={6}><Metric loading={loading} title="Paid to suppliers & carriers" value={loadError ? undefined : totals.paidToVendors} format={money} icon={<BankOutlined />} tone="blue" /></Col><Col xs={24} sm={12} xl={6}><Metric loading={loading} title="Estimated costs" value={loadError ? undefined : totals.estimatedCosts} format={money} icon={<BankOutlined />} tone="amber" /></Col></Row>
    <Card className="content-card" variant="borderless"><Table loading={loading} rowKey="id" dataSource={rows} pagination={{ pageSize: 10, showSizeChanger: false }} scroll={{ x: 1020 }} columns={[{ title: 'Order', dataIndex: 'orderNumber' }, { title: 'Customer', dataIndex: ['customer', 'name'] }, { title: 'Billed', dataIndex: 'billedTotal', align: 'right' as const, render: money }, { title: 'Received', dataIndex: 'paidByCustomer', align: 'right' as const, render: money }, { title: 'Balance', align: 'right' as const, render: (_, row) => money(row.billedTotal - row.paidByCustomer) }, { title: 'Recorded costs', dataIndex: 'actualCosts', align: 'right' as const, render: money }, { title: 'Paid out', dataIndex: 'paidToVendors', align: 'right' as const, render: money }, { title: 'Est. margin', dataIndex: 'margin', align: 'right' as const, render: money }, { title: 'Margin after recorded costs', dataIndex: 'actualMargin', align: 'right' as const, render: money }]} /></Card>
  </>;
}

function StaffAccess({ authMode, notify }: { authMode: string; notify: Notify }) {
  const localPasswordMode = authMode === 'local';
  const firebaseMode = authMode === 'firebase';
  const [rows, setRows] = useState<Staff[]>([]);
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [passwordStaff, setPasswordStaff] = useState<Staff | null>(null);
  const [form] = Form.useForm();
  const [teamForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  async function load() {
    setLoading(true); setLoadError('');
    try { const [staff, allTeams] = await Promise.all([api.staff(), api.teams()]); setRows(staff); setTeams(allTeams); }
    catch (error) { setRows([]); setLoadError(errorText(error, 'Could not load staff access')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function submit(values: { email: string; role: Role; teamId?: string; isTeamLead: boolean; temporaryPassword?: string }) {
    setBusy(true);
    try { await api.createStaff(values); setOpen(false); form.resetFields(); notify('Staff access added'); await load(); }
    catch (error) { notify(errorText(error, 'Could not add staff'), 'error'); }
    finally { setBusy(false); }
  }
  async function submitTeam(values: { name: string }) {
    setBusy(true);
    try { await api.createTeam(values.name); setTeamOpen(false); teamForm.resetFields(); notify('Team created'); await load(); }
    catch (error) { notify(errorText(error, 'Could not create team'), 'error'); }
    finally { setBusy(false); }
  }
  async function submitTemporaryPassword(values: { temporaryPassword: string }) {
    if (!passwordStaff) return;
    setBusy(true);
    try { await api.setTemporaryPassword(passwordStaff.id, values.temporaryPassword); setPasswordStaff(null); passwordForm.resetFields(); notify('Temporary password updated'); await load(); }
    catch (error) { notify(errorText(error, 'Could not update password'), 'error'); }
    finally { setBusy(false); }
  }
  return <><PageHeading kicker="TEAM PERMISSIONS" title="Staff access" subtitle="Assign each staff member to a team and an operational role." action={<Space><Button onClick={() => setTeamOpen(true)}>New team</Button><Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Add staff</Button></Space>} />
    <Alert className="staff-note" type="info" showIcon message={localPasswordMode ? 'Give each staff member their temporary password securely. They must change it on first sign-in.' : firebaseMode ? 'Staff members sign in through your Firebase project. Add their email and role here before their first sign-in.' : 'Demo mode stores staff records but does not provision staff sign-in. Choose Firebase or LAN auth mode to enable staff accounts.'} />
    {loadError && <Alert className="page-alert" type="error" showIcon message={loadError} action={<Button size="small" onClick={() => void load()}>Try again</Button>} />}
    <Card className="content-card" variant="borderless"><Table loading={loading} rowKey="id" dataSource={rows} pagination={false} scroll={{ x: 700 }} columns={[{ title: 'Work email', dataIndex: 'email' }, { title: 'Role', dataIndex: 'role', render: (value: Role) => <Tag>{roleNames[value]}</Tag> }, { title: 'Team', dataIndex: ['team', 'name'], render: (value) => value || 'Unassigned' }, { title: 'Record visibility', dataIndex: 'isTeamLead', render: (_: boolean, row: Staff) => row.role === 'admin' ? <Tag color="purple">All records</Tag> : row.isTeamLead ? <Tag color="blue">Team lead</Tag> : <Tag>Own records</Tag> }, { title: localPasswordMode ? 'LAN password' : firebaseMode ? 'Firebase account' : 'Demo auth', render: (_, row) => localPasswordMode ? <Tag color={row.mustChangePassword ? 'orange' : row.hasLocalPassword ? 'green' : 'default'}>{row.mustChangePassword ? 'Change required' : row.hasLocalPassword ? 'Ready' : 'Not set'}</Tag> : firebaseMode ? row.firebaseUid ? <Tag color="green">Active</Tag> : <Tag>Pending sign-in</Tag> : <Tag>Not available</Tag> }, ...(localPasswordMode ? [{ title: '', render: (_: unknown, row: Staff) => <Button size="small" onClick={() => { setPasswordStaff(row); passwordForm.resetFields(); }}>Set temporary password</Button> }] : [])]} /></Card>
    <Modal title="Add staff access" open={open} onCancel={() => { setOpen(false); form.resetFields(); }} onOk={() => form.submit()} okText="Add staff" confirmLoading={busy}><Form form={form} layout="vertical" onFinish={submit} initialValues={{ isTeamLead: false }}><Form.Item label="Work email" name="email" rules={[{ required: true, type: 'email', message: 'Enter a valid work email' }]}><Input maxLength={180} /></Form.Item>{localPasswordMode && <Form.Item label="Temporary password" name="temporaryPassword" rules={[{ required: true, message: 'Enter a temporary password' }, { min: 12, max: 72, message: 'Use at least 12 characters and no more than 72 UTF-8 bytes' }, { validator: (_, value) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error('Password must be no more than 72 UTF-8 bytes')) }]}><Input.Password /></Form.Item>}<Form.Item label="Operational role" name="role" rules={[{ required: true, message: 'Choose an operational role' }]}><Select options={Object.entries(roleNames).filter(([value]) => value !== 'admin').map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item label="Team" name="teamId"><Select allowClear placeholder="Choose a team" options={teams.map((team) => ({ value: team.id, label: team.name }))} /></Form.Item><Form.Item label="Team lead access" name="isTeamLead" dependencies={['teamId']} rules={[{ required: true, message: 'Choose the record visibility level' }, ({ getFieldValue }) => ({ validator: (_, value) => !value || getFieldValue('teamId') ? Promise.resolve() : Promise.reject(new Error('Assign a team before granting team-lead access')) })]}><Select options={[{ value: false, label: 'Own records only' }, { value: true, label: 'View team members’ customers, orders, and payments' }]} /></Form.Item></Form></Modal>
    <Modal title="Create team" open={teamOpen} onCancel={() => { setTeamOpen(false); teamForm.resetFields(); }} onOk={() => teamForm.submit()} okText="Create team" confirmLoading={busy}><Form form={teamForm} layout="vertical" onFinish={submitTeam}><Form.Item label="Team name" name="name" rules={[{ required: true, whitespace: true, message: 'Enter a team name' }]}><Input maxLength={100} placeholder="e.g. North region" /></Form.Item></Form></Modal>
    <Modal title={`Temporary password · ${passwordStaff?.email ?? ''}`} open={Boolean(passwordStaff)} onCancel={() => { setPasswordStaff(null); passwordForm.resetFields(); }} onOk={() => passwordForm.submit()} okText="Set password" confirmLoading={busy}><Form form={passwordForm} layout="vertical" onFinish={submitTemporaryPassword}><Form.Item label="Temporary password" name="temporaryPassword" rules={[{ required: true, message: 'Enter a temporary password' }, { min: 12, max: 72, message: 'Use at least 12 characters and no more than 72 UTF-8 bytes' }, { validator: (_, value) => !value || new TextEncoder().encode(value).length <= 72 ? Promise.resolve() : Promise.reject(new Error('Password must be no more than 72 UTF-8 bytes')) }]}><Input.Password /></Form.Item></Form></Modal>
  </>;
}
