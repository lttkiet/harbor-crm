import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Staff } from './entities/staff.entity';
import { Team } from './entities/team.entity';
import { Customer } from './entities/customer.entity';
import { Order } from './entities/order.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { DeliveryUpdate } from './entities/delivery-update.entity';
import { WarehouseLocation } from './entities/warehouse-location.entity';
import { InventoryItem } from './entities/inventory-item.entity';
import { InventoryStock } from './entities/inventory-stock.entity';
import { WarehouseMovement } from './entities/warehouse-movement.entity';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AppService', () => {
  let service: AppService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((dto) => Promise.resolve({ id: 'mock-uuid', ...dto })),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
    manager: {
      getRepository: jest.fn().mockReturnValue({
        findOneBy: jest.fn().mockResolvedValue({ id: 'item-1' })
      }),
      transaction: jest.fn((cb) => cb(mockManager)),
    },
  };

  const mockManager = {
    query: jest.fn().mockResolvedValue([{ maxNumber: '10' }]),
    getRepository: jest.fn(() => mockRepository),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: JwtService, useValue: { sign: jest.fn() } },
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              if (key === 'AUTH_MODE') return 'local';
              return null;
            }),
          },
        },
        { provide: getRepositoryToken(Staff), useValue: mockRepository },
        { provide: getRepositoryToken(Team), useValue: mockRepository },
        { provide: getRepositoryToken(Customer), useValue: mockRepository },
        { provide: getRepositoryToken(Order), useValue: mockRepository },
        { provide: getRepositoryToken(LedgerEntry), useValue: mockRepository },
        { provide: getRepositoryToken(DeliveryUpdate), useValue: mockRepository },
        { provide: getRepositoryToken(WarehouseLocation), useValue: mockRepository },
        { provide: getRepositoryToken(InventoryItem), useValue: mockRepository },
        { provide: getRepositoryToken(InventoryStock), useValue: mockRepository },
        { provide: getRepositoryToken(WarehouseMovement), useValue: mockRepository },
        { provide: DataSource, useValue: { query: jest.fn() } },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    process.env.AUTH_MODE = 'local';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Teams and Staff', () => {
    it('should create a team', async () => {
      mockRepository.findOneBy.mockResolvedValueOnce(null);
      const team = await service.createTeam('Alpha');
      expect(team).toEqual({ id: 'mock-uuid', name: 'Alpha' });
      expect(mockRepository.save).toHaveBeenCalledWith({ name: 'Alpha' });
    });

    it('should not create a team if it already exists', async () => {
      mockRepository.findOneBy.mockResolvedValueOnce({ id: '1', name: 'Alpha' });
      await expect(service.createTeam('Alpha')).rejects.toThrow(ForbiddenException);
    });

    it('should create staff successfully in local mode', async () => {
      mockRepository.findOneBy.mockResolvedValueOnce(null); // No existing staff

      const staffDto = { email: 'staff@test.com', role: 'operations' as any, temporaryPassword: 'password123456' };
      const staff = await service.createStaff(staffDto);

      expect(staff.email).toBe('staff@test.com');
      expect(staff.hasLocalPassword).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('password123456', 12);
    });

    it('should set a temporary password', async () => {
      const mockStaff = { id: 'mock-id', email: 'test@test.com', passwordHash: null, mustChangePassword: false };
      mockRepository.findOneBy.mockResolvedValueOnce(mockStaff);

      const result = await service.setTemporaryPassword('mock-id', 'newpassword1234');

      expect(result.mustChangePassword).toBe(true);
      expect(result.hasLocalPassword).toBe(true);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('Customers', () => {
    it('should create a customer for non-admin user', async () => {
      const user = { role: 'operations', sub: 'ops-user' };
      const customerDto = { type: 'business', name: 'Corp' };

      const customer = await service.createCustomer(customerDto as any, user);

      expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        ownerStaffId: 'ops-user'
      }));
      expect(customer).toHaveProperty('id', 'mock-uuid');
    });

    it('should prevent non-owners from updating customer', async () => {
      const user = { role: 'operations', sub: 'ops-user' };
      const mockCustomer = { id: 'cust-id', ownerStaffId: 'other-user' };
      mockRepository.findOneBy.mockResolvedValueOnce(mockCustomer);

      await expect(service.updateCustomer('cust-id', {} as any, user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Warehouse', () => {
    it('should receive warehouse stock', async () => {
      const user = { email: 'test@test.com' };
      const input = { itemId: 'item-1', locationId: 'loc-1', quantity: 10 };

      mockRepository.findOneBy.mockResolvedValueOnce(null); // Stock entry doesn't exist

      const result = await service.receiveWarehouseStock(input as any, user);
      expect(result).toHaveProperty('id', 'mock-uuid');
      expect(mockRepository.manager.transaction).toHaveBeenCalled();
    });
  });
});
