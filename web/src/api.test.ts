import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, setApiToken } from './api';

describe('API client', () => {
  beforeEach(() => {
    setApiToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the session token and parses a successful response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    setApiToken('session-token');

    await expect(api.health()).resolves.toEqual({ status: 'ok' });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/api/health', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer session-token', 'Content-Type': 'application/json' }),
    }));
  });

  it('formats validation errors returned as a message list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ['Email is invalid', 'Name is required'] }), { status: 400 })));

    await expect(api.health()).rejects.toThrow('Email is invalid, Name is required');
  });

  it('returns a readable message when the API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

    await expect(api.health()).rejects.toThrow('Harbor could not reach the API. Check your connection and try again.');
  });
});
