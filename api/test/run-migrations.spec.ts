import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockInitialize = vi.fn();
const mockRunMigrations = vi.fn();
const mockDestroy = vi.fn();

vi.mock('typeorm', () => {
  return {
    DataSource: class MockDataSource {
      initialize = mockInitialize;
      runMigrations = mockRunMigrations;
      destroy = mockDestroy;
      isInitialized = false;
    }
  };
});

vi.mock('../src/database.config', () => ({
  getDatabaseOptions: vi.fn(() => ({})),
}));

describe('run-migrations', () => {
  let consoleErrorSpy: any;
  let consoleLogSpy: any;
  let originalExitCode: number | undefined;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    vi.resetModules();
    mockInitialize.mockReset();
    mockRunMigrations.mockReset();
    mockDestroy.mockReset();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('should run migrations successfully', async () => {
    mockInitialize.mockResolvedValue(undefined);
    mockRunMigrations.mockResolvedValue([]);

    await import('../src/run-migrations');

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(mockInitialize).toHaveBeenCalled();
    expect(mockRunMigrations).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Applied 0 database migration(s).');
    expect(process.exitCode).toBeUndefined();
  });

  it('should handle errors and set process.exitCode', async () => {
    const error = new Error('Connection failed');
    error.name = 'ConnectionError';
    mockInitialize.mockRejectedValue(error);

    await import('../src/run-migrations');

    // Wait for promises to resolve
    await new Promise(process.nextTick);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Database migration failed (ConnectionError). Check database connectivity and migration state.'
    );
    expect(process.exitCode).toBe(1);
  });
});
