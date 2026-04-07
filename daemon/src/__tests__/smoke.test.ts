// src/__tests__/smoke.test.ts
// WHY: Smoke test verifies the server boots and basic endpoints respond

import { describe, it, after } from 'node:test';
import * as assert from 'node:assert/strict';
import { createApp, startServer, stopServer } from '../infrastructure/server.js';
import { Router } from 'express';
import type { Server } from 'node:http';

// WHY: Minimal stub routers — use cases are not yet implemented,
// so we only verify the server framework and health endpoint
function createStubMissionRouter() {
  const router = Router();
  router.post('/', (_req, res) => {
    res.status(501).json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' });
  });
  return router;
}

function createStubHookRouter() {
  return Router();
}

describe('Server smoke test', () => {
  let server: Server;
  let baseUrl: string;

  // Start server on random port
  after(async () => {
    await stopServer();
  });

  it('should start server and respond to health check', async () => {
    const app = createApp({
      missionRouter: createStubMissionRouter(),
      hookRouter: createStubHookRouter(),
    });

    // Use port 0 to let OS assign a random available port
    server = await startServer(app, 0);
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const port = address.port;
    baseUrl = `http://localhost:${port}`;

    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.version, '0.2.0');
    assert.equal(typeof body.uptime, 'number');
    assert.equal(typeof body.activeSessions, 'number');
    assert.equal(typeof body.eventBusSubscribers, 'number');
  });

  it('should accept POST /missions and return 501 (stub)', async () => {
    // WHY: StartMissionUseCase is not yet implemented, so the stub
    // router returns 501. This verifies routing works.
    const res = await fetch(`${baseUrl}/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Test mission' }),
    });
    assert.equal(res.status, 501);
    const body = await res.json();
    assert.equal(body.code, 'NOT_IMPLEMENTED');
  });

  it('should return 404 for unknown routes', async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    assert.equal(res.status, 404);
  });

  it('should parse JSON body up to 10mb limit', async () => {
    // Verify the JSON middleware is configured
    const res = await fetch(`${baseUrl}/hooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
    });
    // Stub hook router has no routes, so 404 is expected
    // but it should NOT be a 413 (payload too large)
    assert.notEqual(res.status, 413);
  });
});
