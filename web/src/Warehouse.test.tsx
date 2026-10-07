import { render, screen } from '@testing-library/react';
import Warehouse from './Warehouse';
import { Provider } from 'react-redux';
import { store } from './store';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock dependencies
jest.mock('./api', () => ({
  apiCall: jest.fn().mockResolvedValue([]),
}));

jest.mock('./AuthContext', () => ({
  useAuth: () => ({ user: { id: 'mock-user-id', role: 'warehouse', email: 'test@test.com' }, notify: jest.fn() }),
}));

jest.mock('./OrderBarcode', () => ({
  __esModule: true,
  default: () => <div>OrderBarcode Mock</div>
}));

describe('Warehouse Component', () => {
  it('renders Warehouse without crashing', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <Warehouse user={{ id: 'mock-id', role: 'warehouse' } as any} notify={jest.fn()} />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText(/INVENTORY AND FULFILLMENT/i)).toBeInTheDocument();
  });
});
