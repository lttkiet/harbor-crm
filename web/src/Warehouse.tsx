import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Divider, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography } from 'antd';
import { AppstoreOutlined, EnvironmentOutlined, InboxOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, SendOutlined } from '@ant-design/icons';
import { api } from './api';
import OrderBarcode from './OrderBarcode';
import type { InventoryItem, InventoryStock, Staff, WarehouseLocation, WarehouseLookup, WarehouseMovement, WarehouseTask } from './types';

const { Text, Title } = Typography;
type Notify = (text: string, kind?: 'success' | 'error') => void;
type Action = 'item' | 'location' | 'receive' | 'pick' | null;
const movementLabels: Record<WarehouseMovement['type'], string> = { receipt: 'Received', pick: 'Picked', dispatch: 'Dispatched' };

export default function Warehouse({ user, notify }: { user: Pick<Staff, 'id' | 'role'>; notify: Notify }) {
  const [stock, setStock] = useState<InventoryStock[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [tasks, setTasks] = useState<WarehouseTask[]>([]);
  const [movements, setMovements] = useState<WarehouseMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lookup, setLookup] = useState<WarehouseLookup | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action>(null);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const lookupRequest = useRef(0);
  const [form] = Form.useForm();
  const isAdmin = user.role === 'admin';
  const mutableTasks = useMemo(() => tasks.filter((task) => isAdmin || task.warehouseStaffId === user.id), [isAdmin, tasks, user.id]);
  const receiptTasks = mutableTasks.filter((task) => task.type === 'buy');
  const pickTasks = mutableTasks.filter((task) => task.status === 'ready');
  const availableUnits = stock.reduce((sum, row) => sum + Math.max(0, row.quantityOnHand - row.quantityPicked), 0);
  const lowStock = stock.filter((row) => row.quantityOnHand - row.quantityPicked <= row.item.reorderLevel).length;

  async function refreshLookup() {
    const code = lookup?.task.orderNumber;
    await load();
    if (code) {
      try {
        setLookup(await api.warehouseLookup(code));
      } catch (error) {
        setLookupError(error instanceof Error ? error.message : 'Could not refresh warehouse activity');
      }
    }
  }

  async function lookupBarcode(value: string) {
    const code = value.trim();
    if (!code) return;
    const requestId = ++lookupRequest.current;
    setLookupBusy(true);
    setLookupError('');
    try {
      const result = await api.warehouseLookup(code);
      if (requestId === lookupRequest.current) setLookup(result);
    } catch (error) {
      if (requestId === lookupRequest.current) {
        setLookup(null);
        setLookupError(error instanceof Error ? error.message : 'Barcode not found');
      }
    } finally {
      if (requestId === lookupRequest.current) {
        setLookupBusy(false);
        setBarcode('');
        window.requestAnimationFrame(() => document.getElementById('warehouse-barcode-input')?.focus());
      }
    }
  }

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [nextStock, nextItems, nextLocations, nextTasks, nextMovements] = await Promise.all([
        api.warehouseStock(),
        api.warehouseItems(),
        api.warehouseLocations(),
        api.warehouseTasks(),
        api.warehouseMovements(),
      ]);
      setStock(nextStock);
      setItems(nextItems);
      setLocations(nextLocations);
      setTasks(nextTasks);
      setMovements(nextMovements);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load warehouse operations');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  function openAction(next: Exclude<Action, null>, values: Record<string, unknown> = {}) {
    form.resetFields();
    form.setFieldsValue({ quantity: 1, reorderLevel: 0, unit: 'each', ...values });
    setAction(next);
  }

  async function submit(values: any) {
    setBusy(true);
    try {
      if (action === 'item') await api.createInventoryItem(values);
      if (action === 'location') await api.createWarehouseLocation(values);
      if (action === 'receive') await api.receiveWarehouseStock({ ...values, orderId: values.orderId || undefined });
      if (action === 'pick') await api.pickWarehouseStock(values);
      setAction(null);
      form.resetFields();
      notify(action === 'item' ? 'Inventory item added' : action === 'location' ? 'Warehouse location added' : action === 'receive' ? 'Stock received' : 'Stock picked for dispatch');
      await refreshLookup();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save warehouse activity', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function dispatch(movement: WarehouseMovement) {
    setDispatching(movement.id);
    try {
      await api.dispatchWarehouseStock(movement.id, {});
      notify('Picked stock dispatched');
      await refreshLookup();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not dispatch picked stock', 'error');
    } finally {
      setDispatching(null);
    }
  }

  const stockColumns = [
    {
      title: 'Item',
      key: 'item',
      render: (_: unknown, row: InventoryStock) => (
        <div className="warehouse-item">
          <strong>{row.item.name}</strong>
          <small>
            {row.item.sku} · reorder at {row.item.reorderLevel} {row.item.unit}
          </small>
        </div>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      render: (_: unknown, row: InventoryStock) => (
        <div className="warehouse-item">
          <strong>{row.location.warehouseName}</strong>
          <small>{row.location.code}</small>
        </div>
      ),
    },
    { title: 'On hand', dataIndex: 'quantityOnHand', align: 'right' as const, render: (value: number, row: InventoryStock) => `${value} ${row.item.unit}` },
    { title: 'Picked', dataIndex: 'quantityPicked', align: 'right' as const, render: (value: number, row: InventoryStock) => `${value} ${row.item.unit}` },
    {
      title: 'Available',
      key: 'available',
      align: 'right' as const,
      render: (_: unknown, row: InventoryStock) => {
        const value = row.quantityOnHand - row.quantityPicked;
        return (
          <Tag color={value <= row.item.reorderLevel ? 'orange' : 'green'}>
            {value} {row.item.unit}
          </Tag>
        );
      },
    },
  ];
  const movementColumns = [
    {
      title: 'Activity',
      key: 'activity',
      render: (_: unknown, row: WarehouseMovement) => (
        <div className="warehouse-item">
          <strong>{row.item?.name ?? 'Inventory item'}</strong>
          <small>
            {row.item?.sku ?? '—'} · {new Date(row.createdAt).toLocaleString()}
          </small>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'type', render: (value: WarehouseMovement['type']) => <Tag color={value === 'receipt' ? 'green' : value === 'pick' ? 'blue' : 'purple'}>{movementLabels[value]}</Tag> },
    { title: 'Quantity', dataIndex: 'quantity', align: 'right' as const, render: (value: number, row: WarehouseMovement) => `${value} ${row.item?.unit ?? 'units'}` },
    { title: 'Location', key: 'location', render: (_: unknown, row: WarehouseMovement) => `${row.location?.warehouseName ?? '—'} · ${row.location?.code ?? '—'}` },
    { title: 'Order', key: 'order', render: (_: unknown, row: WarehouseMovement) => row.order?.orderNumber ?? 'Unlinked' },
    {
      title: '',
      key: 'action',
      render: (_: unknown, row: WarehouseMovement) => {
        const canDispatch = row.type === 'pick' && row.pendingDispatch && (isAdmin || row.order?.warehouseStaffId === user.id);
        return canDispatch ? (
          <Button size="small" type="primary" ghost icon={<SendOutlined />} loading={dispatching === row.id} onClick={() => void dispatch(row)}>
            Dispatch
          </Button>
        ) : null;
      },
    },
  ];
  const itemColumns = [
    { title: 'SKU', dataIndex: 'sku', render: (value: string) => <Text strong>{value}</Text> },
    { title: 'Item', dataIndex: 'name' },
    { title: 'Unit', dataIndex: 'unit' },
    { title: 'Reorder at', dataIndex: 'reorderLevel', align: 'right' as const },
  ];
  const locationColumns = [
    {
      title: 'Warehouse',
      dataIndex: 'warehouseName',
      render: (value: string, row: WarehouseLocation) => (
        <div className="warehouse-item">
          <strong>{value}</strong>
          <small>{row.address || 'No address added'}</small>
        </div>
      ),
    },
    { title: 'Location code', dataIndex: 'code', render: (value: string) => <Tag color="geekblue">{value}</Tag> },
  ];
  const lookupCanOperate = Boolean(lookup && (isAdmin || lookup.task.warehouseStaffId === user.id));
  const lookupMovementColumns = [
    {
      title: 'Activity',
      key: 'activity',
      render: (_: unknown, row: WarehouseMovement) => (
        <div className="warehouse-item">
          <strong>
            {row.item.name} · {movementLabels[row.type]}
          </strong>
          <small>
            {row.item.sku} · {row.location.warehouseName} · {row.location.code}
          </small>
        </div>
      ),
    },
    { title: 'Quantity', dataIndex: 'quantity', align: 'right' as const, render: (value: number, row: WarehouseMovement) => `${value} ${row.item.unit}` },
    { title: 'Date', dataIndex: 'createdAt', render: (value: string) => new Date(value).toLocaleString() },
    {
      title: 'Dispatch',
      key: 'dispatch',
      render: (_: unknown, row: WarehouseMovement) =>
        row.type === 'pick' ? <Tag color={row.pendingDispatch ? 'orange' : 'green'}>{row.pendingDispatch ? 'Awaiting dispatch' : 'Dispatched'}</Tag> : '—',
    },
    {
      title: '',
      key: 'action',
      render: (_: unknown, row: WarehouseMovement) =>
        lookupCanOperate && row.type === 'pick' && row.pendingDispatch ? (
          <Button size="small" type="primary" ghost loading={dispatching === row.id} onClick={() => void dispatch(row)}>
            Dispatch
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <div className="warehouse-heading page-heading">
        <div>
          <Text className="eyebrow">INVENTORY AND FULFILLMENT</Text>
          <Title level={2}>Warehouse</Title>
          <Text type="secondary">Manage stock locations, receive goods, and prepare assigned shipments for dispatch.</Text>
        </div>
        <Space wrap>
          <Input.Search
            id="warehouse-barcode-input"
            className="warehouse-barcode-input"
            autoFocus
            allowClear
            value={barcode}
            onChange={(event: any) => setBarcode(event.target.value)}
            onSearch={(value: any) => void lookupBarcode(value)}
            loading={lookupBusy}
            prefix={<SearchOutlined />}
            placeholder="Scan package barcode or enter order ID"
            aria-label="Scan package barcode or enter order ID"
            enterButton="Find package"
          />
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
            Refresh
          </Button>
          <Button icon={<EnvironmentOutlined />} onClick={() => openAction('location')}>
            Add location
          </Button>
          <Button icon={<AppstoreOutlined />} onClick={() => openAction('item')}>
            Add item
          </Button>
          <Button icon={<InboxOutlined />} onClick={() => openAction('receive')} type="primary">
            Receive stock
          </Button>
          <Button icon={<SendOutlined />} onClick={() => openAction('pick')} disabled={!pickTasks.length}>
            Pick for dispatch
          </Button>
        </Space>
      </div>
      {lookupError && <Alert className="page-alert" type="warning" showIcon message={lookupError} closable onClose={() => setLookupError('')} />}
      {lookup && (
        <Card className="content-card warehouse-lookup" variant="borderless">
          <div className="warehouse-lookup-heading">
            <div>
              <Text className="eyebrow">PACKAGE LOOKUP</Text>
              <Title level={4}>{lookup.task.orderNumber}</Title>
              <Text type="secondary">
                {lookup.task.type === 'buy' ? 'Buy order' : 'Transport order'} · {lookup.task.status.replace(/_/g, ' ')}
              </Text>
            </div>
            <Tag color={lookup.task.status === 'ready' ? 'cyan' : lookup.task.status === 'delivered' ? 'green' : 'blue'}>{lookup.task.status.replace(/_/g, ' ')}</Tag>
          </div>
          <OrderBarcode orderNumber={lookup.task.orderNumber} type={lookup.task.type} />
          <Row gutter={[12, 12]} className="warehouse-lookup-details">
            {lookup.task.origin && (
              <Col xs={24} sm={12}>
                <Text type="secondary">Origin</Text>
                <strong>{lookup.task.origin}</strong>
              </Col>
            )}
            {lookup.task.destination && (
              <Col xs={24} sm={12}>
                <Text type="secondary">Destination</Text>
                <strong>{lookup.task.destination}</strong>
              </Col>
            )}
            {lookup.task.cargoDescription && (
              <Col span={24}>
                <Text type="secondary">Cargo</Text>
                <strong>{lookup.task.cargoDescription}</strong>
              </Col>
            )}
            {lookup.task.items.length > 0 && (
              <Col span={24}>
                <Text type="secondary">Order items</Text>
                <strong>{lookup.task.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}</strong>
              </Col>
            )}
            {lookup.task.carrierName && (
              <Col xs={24} sm={12}>
                <Text type="secondary">Carrier</Text>
                <strong>{lookup.task.carrierName}</strong>
              </Col>
            )}
            {lookup.task.trackingNumber && (
              <Col xs={24} sm={12}>
                <Text type="secondary">Tracking</Text>
                <strong>{lookup.task.trackingNumber}</strong>
              </Col>
            )}
          </Row>
          <Divider />
          <div className="card-heading">
            <div>
              <Title level={5}>Inventory activity</Title>
              <Text type="secondary">Receipts, picks, and dispatches linked to this order.</Text>
            </div>
          </div>
          <Table
            size="small"
            rowKey="id"
            dataSource={lookup.movements}
            columns={lookupMovementColumns}
            pagination={false}
            scroll={{ x: 620 }}
            locale={{ emptyText: <Empty description="No inventory activity linked to this order." /> }}
          />
          {lookupCanOperate && (
            <Space wrap className="warehouse-lookup-actions">
              {lookup.task.type === 'buy' && (
                <Button icon={<InboxOutlined />} onClick={() => openAction('receive', { orderId: lookup.task.id })}>
                  Receive for this order
                </Button>
              )}
              {lookup.task.type === 'transport' && lookup.task.status === 'ready' && (
                <Button type="primary" icon={<SendOutlined />} onClick={() => openAction('pick', { orderId: lookup.task.id })}>
                  Pick for this order
                </Button>
              )}
            </Space>
          )}
        </Card>
      )}
      {loadError && (
        <Alert
          className="page-alert"
          type="error"
          showIcon
          message={loadError}
          action={
            <Button size="small" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      )}
      <Row gutter={[16, 16]} className="metric-row">
        <Col xs={24} sm={8}>
          <Card className="warehouse-stat" variant="borderless">
            <Statistic title="Available units" value={availableUnits} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="warehouse-stat" variant="borderless">
            <Statistic title="Needs replenishment" value={lowStock} prefix={<InboxOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="warehouse-stat" variant="borderless">
            <Statistic title="Ready shipments" value={pickTasks.length} prefix={<SendOutlined />} />
          </Card>
        </Col>
      </Row>
      <Tabs
        className="warehouse-tabs"
        items={[
          {
            key: 'stock',
            label: 'Stock on hand',
            children: (
              <Card className="content-card" variant="borderless">
                <div className="card-heading">
                  <div>
                    <Title level={4}>Inventory by location</Title>
                    <Text type="secondary">Available quantity excludes stock already picked.</Text>
                  </div>
                </div>
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={stock}
                  columns={stockColumns}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: 760 }}
                  locale={{ emptyText: <Empty description="No stock yet. Add items and receive your first delivery." /> }}
                />
              </Card>
            ),
          },
          {
            key: 'activity',
            label: 'Warehouse activity',
            children: (
              <Card className="content-card" variant="borderless">
                <div className="card-heading">
                  <div>
                    <Title level={4}>Recent movements</Title>
                    <Text type="secondary">Receipts, picks, and dispatches.</Text>
                  </div>
                </div>
                <Table
                  loading={loading}
                  rowKey="id"
                  dataSource={movements}
                  columns={movementColumns}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: 820 }}
                  locale={{ emptyText: <Empty description="No warehouse activity has been recorded." /> }}
                />
              </Card>
            ),
          },
          {
            key: 'catalog',
            label: 'Items and locations',
            children: (
              <Row gutter={[16, 16]}>
                <Col xs={24} xl={12}>
                  <Card className="content-card" variant="borderless">
                    <div className="card-heading">
                      <div>
                        <Title level={4}>Inventory items</Title>
                        <Text type="secondary">
                          {items.length} item{items.length === 1 ? '' : 's'} in the catalog.
                        </Text>
                      </div>
                      <Button icon={<PlusOutlined />} onClick={() => openAction('item')}>
                        Add item
                      </Button>
                    </div>
                    <Table
                      loading={loading}
                      rowKey="id"
                      dataSource={items}
                      columns={itemColumns}
                      pagination={{ pageSize: 6, showSizeChanger: false }}
                      scroll={{ x: 440 }}
                      locale={{ emptyText: <Empty description="Add an item before receiving stock." /> }}
                    />
                  </Card>
                </Col>
                <Col xs={24} xl={12}>
                  <Card className="content-card" variant="borderless">
                    <div className="card-heading">
                      <div>
                        <Title level={4}>Storage locations</Title>
                        <Text type="secondary">
                          {locations.length} location{locations.length === 1 ? '' : 's'} configured.
                        </Text>
                      </div>
                      <Button icon={<EnvironmentOutlined />} onClick={() => openAction('location')}>
                        Add location
                      </Button>
                    </div>
                    <Table
                      loading={loading}
                      rowKey="id"
                      dataSource={locations}
                      columns={locationColumns}
                      pagination={{ pageSize: 6, showSizeChanger: false }}
                      scroll={{ x: 420 }}
                      locale={{ emptyText: <Empty description="Add a location before receiving stock." /> }}
                    />
                  </Card>
                </Col>
              </Row>
            ),
          },
        ]}
      />

      <Modal
        title={action === 'item' ? 'Add inventory item' : action === 'location' ? 'Add warehouse location' : action === 'receive' ? 'Receive stock' : 'Pick stock for dispatch'}
        open={action !== null}
        onCancel={() => {
          setAction(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={action === 'receive' ? 'Receive stock' : action === 'pick' ? 'Confirm pick' : 'Save'}
        confirmLoading={busy}
      >
        <Form form={form} layout="vertical" onFinish={submit}>
          {action === 'item' && (
            <>
              <Form.Item label="SKU" name="sku" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={80} placeholder="e.g. BOX-MEDIUM" />
              </Form.Item>
              <Form.Item label="Item name" name="name" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={180} placeholder="Product or packaging" />
              </Form.Item>
              <Row gutter={14}>
                <Col span={12}>
                  <Form.Item label="Unit" name="unit" rules={[{ required: true, whitespace: true }]}>
                    <Input maxLength={30} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Reorder level" name="reorderLevel" rules={[{ required: true }]}>
                    <InputNumber min={0} precision={0} className="full-width" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}
          {action === 'location' && (
            <>
              <Form.Item label="Warehouse name" name="warehouseName" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={180} placeholder="Main warehouse" />
              </Form.Item>
              <Form.Item label="Location code" name="code" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={60} placeholder="A-01-01" />
              </Form.Item>
              <Form.Item label="Address or description" name="address">
                <Input maxLength={1000} />
              </Form.Item>
            </>
          )}
          {(action === 'receive' || action === 'pick') && (
            <>
              <Form.Item label="Inventory item" name="itemId" rules={[{ required: true, message: 'Choose an inventory item' }]}>
                <Select showSearch optionFilterProp="label" options={items.map((item) => ({ value: item.id, label: `${item.sku} · ${item.name}` }))} placeholder="Choose an item" />
              </Form.Item>
              <Form.Item label="Location" name="locationId" rules={[{ required: true, message: 'Choose a location' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  options={locations.map((location) => ({ value: location.id, label: `${location.warehouseName} · ${location.code}` }))}
                  placeholder="Choose a location"
                />
              </Form.Item>
              {action === 'pick' && (
                <Form.Item label="Ready shipment" name="orderId" rules={[{ required: true, message: 'Choose an assigned shipment' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    options={pickTasks.map((task) => ({
                      value: task.id,
                      label: `${task.orderNumber} · ${task.destination || task.cargoDescription || task.items.map((item) => item.name).join(', ') || 'Shipment'}`,
                    }))}
                    placeholder="Choose a shipment"
                  />
                </Form.Item>
              )}
              {action === 'receive' && (
                <Form.Item label="Link buy order (optional)" name="orderId">
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={receiptTasks.map((task) => ({ value: task.id, label: `${task.orderNumber} · ${task.cargoDescription || task.items.map((item) => item.name).join(', ')}` }))}
                    placeholder="Leave unlinked"
                  />
                </Form.Item>
              )}
              <Form.Item label="Quantity" name="quantity" rules={[{ required: true, message: 'Enter a quantity' }]}>
                <InputNumber min={1} max={1000000} precision={0} className="full-width" />
              </Form.Item>
              <Form.Item label="Notes" name="notes">
                <Input.TextArea rows={2} maxLength={5000} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </>
  );
}
