import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button, Typography } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import JsBarcode from 'jsbarcode';

const { Text } = Typography;

function BarcodeSvg({ value, className }: { value: string; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (svgRef.current) JsBarcode(svgRef.current, value, { format: 'CODE128', width: 1.7, height: 46, displayValue: false, margin: 2, lineColor: '#172438', background: '#fff' });
  }, [value]);
  return <svg ref={svgRef} className={className} role="img" aria-label={`Code 128 barcode for ${value}`} />;
}

export default function OrderBarcode({ orderNumber, type }: { orderNumber: string; type: 'buy' | 'transport' }) {
  const labelType = type === 'buy' ? 'BUY ORDER' : 'TRANSPORT ORDER';
  return <div className="order-barcode">
    <div className="order-barcode-preview">
      <Text type="secondary">Package barcode</Text>
      <BarcodeSvg value={orderNumber} />
      <strong>{orderNumber}</strong>
    </div>
    <Button icon={<PrinterOutlined />} onClick={() => window.print()}>Print package label</Button>
    {createPortal(<div id="package-label-print" aria-hidden="true">
      <strong className="package-label-brand">HARBOR</strong>
      <span className="package-label-type">{labelType}</span>
      <BarcodeSvg value={orderNumber} className="package-label-code" />
      <strong className="package-label-id">{orderNumber}</strong>
    </div>, document.body)}
  </div>;
}
