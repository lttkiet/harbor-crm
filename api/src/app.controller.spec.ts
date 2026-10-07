import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Staff } from './entities/staff.entity';

describe('AppController', () => {
  let appController: AppController;
  let appService: AppService;

  beforeEach(async () => {
    const mockAppService = {
      createSession: jest.fn(),
      localSession: jest.fn(),
      changePassword: jest.fn(),
      dashboard: jest.fn(),
      listCustomers: jest.fn(),
      createCustomer: jest.fn(),
      updateCustomer: jest.fn(),
      listOrders: jest.fn(),
      finance: jest.fn(),
      warehouseAssignees: jest.fn(),
      warehouseTasks: jest.fn(),
      warehouseLookup: jest.fn(),
      warehouseLocations: jest.fn(),
      createWarehouseLocation: jest.fn(),
      warehouseItems: jest.fn(),
      createInventoryItem: jest.fn(),
      warehouseStock: jest.fn(),
      warehouseMovements: jest.fn(),
      receiveWarehouseStock: jest.fn(),
      pickWarehouseStock: jest.fn(),
      dispatchWarehouseStock: jest.fn(),
      createOrder: jest.fn(),
      getOrder: jest.fn(),
      addDeliveryUpdate: jest.fn(),
      addLedgerEntry: jest.fn(),
      listTeams: jest.fn(),
      createTeam: jest.fn(),
      listStaff: jest.fn(),
      createStaff: jest.fn(),
      setTemporaryPassword: jest.fn(),
      requireRole: jest.fn(),
    };

    const mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        { provide: getRepositoryToken(Staff), useValue: {} },
        { provide: JwtService, useValue: { sign: jest.fn() } },
        { provide: AppService, useValue: mockAppService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
    appService = app.get<AppService>(AppService);
  });

  describe('root', () => {
    it('should return health status', () => {
      expect(appController.health()).toEqual({ status: 'ok' });
    });

    it('should return ready status', async () => {
      await expect(appController.ready()).resolves.toEqual({ status: 'ready' });
    });
  });

  describe('auth', () => {
    it('should call createSession on AppService', () => {
      const idToken = 'mock-id-token';
      appController.createSession({ idToken });
      expect(appService.createSession).toHaveBeenCalledWith(idToken);
    });

    it('should call localSession on AppService', () => {
      const email = 'test@test.com';
      const password = 'mock-password';
      appController.localSession({ email, password });
      expect(appService.localSession).toHaveBeenCalledWith(email, password);
    });

    it('should return current session user', () => {
      const user = { id: 1, email: 'test@test.com' };
      expect(appController.currentSession({ user })).toEqual({ user });
    });
  });

  describe('warehouse', () => {
    it('should call createWarehouseLocation', () => {
      const body = { warehouseName: 'Main', code: 'WH1' };
      appController.createWarehouseLocation(body, { user: { role: 'admin' } });
      expect(appService.createWarehouseLocation).toHaveBeenCalledWith(body);
    });
  });

  describe('teams and staff', () => {
    it('should call listTeams', () => {
      appController.teams({ user: { role: 'admin' } });
      expect(appService.listTeams).toHaveBeenCalled();
    });

    it('should call createTeam', () => {
      appController.createTeam({ name: 'Alpha' }, { user: { role: 'admin' } });
      expect(appService.createTeam).toHaveBeenCalledWith('Alpha');
    });
  });
});
