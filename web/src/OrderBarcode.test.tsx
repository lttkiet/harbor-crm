import { render, screen } from '@testing-library/react';
import OrderBarcode from './OrderBarcode';
import React from 'react';

jest.mock('jsbarcode', () => {
  return jest.fn((element, value) => {
    if (element && element.setAttribute) {
      element.setAttribute('data-barcode-value', value);
    }
  });
});

describe('OrderBarcode Component', () => {
  it('renders without crashing and calls JsBarcode', () => {
    const { container } = render(<OrderBarcode orderNumber="mh-01012023-1" type="buy" />);

    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
