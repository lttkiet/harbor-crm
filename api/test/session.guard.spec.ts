import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { SessionGuard } from '../src/session.guard';

describe('SessionGuard', () => {
  let jwt: any;
  let staffRepository: any;
  let guard: SessionGuard;

  beforeEach(() => {
    jwt = { verifyAsync: vi.fn() };
    staffRepository = { findOne: vi.fn() };
    guard = new SessionGuard(jwt, staffRepository);
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_MODE', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function createMockContext(headers: Record<string, string> = {}, path: string = '/'): ExecutionContext & { request: any } {
    const request = { headers, path, user: undefined };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
    return context as any;
  }

  it('bypasses authentication in dev mode', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('AUTH_MODE', 'dev');

    const context = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.request.user).toEqual({ sub: 'local-admin', email: 'admin@example.com', role: 'admin' });
  });

  it('throws UnauthorizedException if no token is provided', async () => {
    const context = createMockContext();
    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Sign in to continue'));
  });

  it('throws UnauthorizedException if token verification fails', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('Invalid token'));
    const context = createMockContext({ authorization: 'Bearer invalid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Session expired'));
  });

  it('throws UnauthorizedException if staff account is not found', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id' });
    staffRepository.findOne.mockResolvedValue(null);
    const context = createMockContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Staff account is no longer active'));
  });

  it('throws UnauthorizedException if session version does not match', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id', sessionVersion: 1 });
    staffRepository.findOne.mockResolvedValue({ id: 'staff-id', sessionVersion: 2 });
    const context = createMockContext({ authorization: 'Bearer valid-token' });

    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Session expired'));
  });

  it('throws UnauthorizedException if password change is required and path is not allowed', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id', sessionVersion: 1 });
    staffRepository.findOne.mockResolvedValue({
      id: 'staff-id',
      sessionVersion: 1,
      mustChangePassword: true,
    });
    const context = createMockContext({ authorization: 'Bearer valid-token' }, '/api/some-endpoint');

    await expect(guard.canActivate(context)).rejects.toThrow(new UnauthorizedException('Change your temporary password before continuing'));
  });

  it('allows access if password change is required but path is /auth/password', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id', sessionVersion: 1 });
    staffRepository.findOne.mockResolvedValue({
      id: 'staff-id',
      sessionVersion: 1,
      mustChangePassword: true,
    });
    const context = createMockContext({ authorization: 'Bearer valid-token' }, '/auth/password');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access if password change is required but path is /auth/me', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id', sessionVersion: 1 });
    staffRepository.findOne.mockResolvedValue({
      id: 'staff-id',
      sessionVersion: 1,
      mustChangePassword: true,
    });
    const context = createMockContext({ authorization: 'Bearer valid-token' }, '/auth/me');

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('allows access and attaches user to request if all checks pass', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'staff-id', sessionVersion: 1 });
    staffRepository.findOne.mockResolvedValue({
      id: 'staff-id',
      email: 'staff@example.com',
      role: 'admin',
      teamId: 'team-1',
      isTeamLead: false,
      sessionVersion: 1,
      mustChangePassword: false,
    });
    const context = createMockContext({ authorization: 'Bearer valid-token' });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(context.request.user).toEqual({
      sub: 'staff-id',
      id: 'staff-id',
      email: 'staff@example.com',
      role: 'admin',
      teamId: 'team-1',
      isTeamLead: false,
      mustChangePassword: false,
    });
  });
});
