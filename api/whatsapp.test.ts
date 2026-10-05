import { describe, it, expect } from 'vitest';
import handler, { _testResetWhatsapp } from './whatsapp';

function mockRes() {
  let code = 200;
  let body: any = null;
  return { res: { status: (c: number) => ({ json: (b: any) => { code = c; body = b; return { code, body }; } }) }, get: () => ({ code, body }) };
}

describe('whatsapp gating (paid API)', () => {
  it('GET health reports configured=false without token', async () => {
    delete process.env.WHATSAPP_TOKEN;
    const { res, get } = mockRes();
    await handler({ method: 'GET', url: '/api/whatsapp', headers: {} }, res);
    expect(get().code).toBe(200);
    expect(get().body.configured).toBe(false);
  });

  it('POST without token is 503 (correctly off by default)', async () => {
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    _testResetWhatsapp();
    const { res, get } = mockRes();
    await handler({ method: 'POST', body: { entry: [] }, headers: {} }, res);
    expect(get().code).toBe(503);
  });

  it('verification handshake succeeds only with matching token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    const { res, get } = mockRes();
    await handler({ method: 'GET', url: '/api/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc', headers: {} }, res);
    expect(get().body).toEqual({ challenge: 'abc' });
  });
});
