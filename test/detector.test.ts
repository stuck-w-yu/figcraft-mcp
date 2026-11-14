import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { isPortOpen, findCliBinary } from '../dist/detector.js';

test('findCliBinary returns null for non-existent path', () => {
  assert.equal(findCliBinary('/tmp/does-not-exist-figcraft-test'), null);
});

test('findCliBinary returns custom path if executable', () => {
  assert.equal(findCliBinary(process.execPath), process.execPath);
});

test('isPortOpen detects open and closed ports', async () => {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const port = (server.address() as net.AddressInfo).port;

  const open = await isPortOpen(port, '127.0.0.1', 200);
  assert.equal(open, true);

  await new Promise<void>((resolve) => server.close(() => resolve()));

  const closed = await isPortOpen(port, '127.0.0.1', 200);
  assert.equal(closed, false);
});
