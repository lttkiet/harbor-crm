import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AppService } from '../src/app.service';

function service(customers = { create: vi.fn((value) => value), save: vi.fn(async (value) => value) }) {
  return new AppService(customers as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
}

describe('AppService', () => {
  it('allows a role included in the action policy', () => {
    expect(() => service().requireRole({ role: 'operations' }, ['admin', 'operations'])).not.toThrow();
  });

  it('rejects a role outside the action policy', () => {
    expect(() => service().requireRole({ role: 'finance' }, ['admin', 'operations'])).toThrow(ForbiddenException);
  });

  it('normalizes customer email and assigns the authenticated owner', async () => {
    const customers = { create: vi.fn((value) => value), save: vi.fn(async (value) => value) };

    const result = await service(customers).createCustomer(
      { type: 'individual', name: 'A Customer', email: 'CUSTOMER@EXAMPLE.COM', contactName: 'Ignored', taxId: 'Ignored' },
      { sub: 'staff-1' },
    );

    expect(result).toMatchObject({
      type: 'individual',
      email: 'customer@example.com',
      ownerStaffId: 'staff-1',
      contactName: null,
      taxId: null,
    });
    expect(customers.save).toHaveBeenCalledOnce();
  });

  it('keeps local demo customers unassigned', async () => {
    const customers = { create: vi.fn((value) => value), save: vi.fn(async (value) => value) };

    const result = await service(customers).createCustomer({ type: 'business', name: 'Demo' }, { sub: 'local-admin' });

    expect(result.ownerStaffId).toBeNull();
  });
});
