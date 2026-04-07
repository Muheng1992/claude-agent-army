#!/usr/bin/env node
// bin/daemon.ts
// WHY: CLI 入口 — start/stop/status 子命令，無需外部 CLI 框架

import { fork } from 'node:child_process';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = resolve(process.cwd(), 'data');
const PID_FILE = join(DATA_DIR, 'daemon.pid');

const USAGE = `
Usage: daemon <command>

Commands:
  start   啟動 daemon（背景執行）
  stop    停止 daemon
  status  顯示 daemon 狀態
`;

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case 'start':
      await handleStart();
      break;
    case 'stop':
      await handleStop();
      break;
    case 'status':
      await handleStatus();
      break;
    default:
      console.log(USAGE.trim());
      process.exit(command ? 1 : 0);
  }
}

async function handleStart(): Promise<void> {
  const existingPid = await readPid();
  if (existingPid && isProcessAlive(existingPid)) {
    console.log(`Daemon already running (PID: ${existingPid})`);
    return;
  }

  // WHY: fork main.ts 作為背景 process，detach 後父 process 退出
  const mainPath = join(__dirname, '..', 'infrastructure', 'main.js');
  const child = fork(mainPath, [], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd(),
  });

  if (!child.pid) {
    console.error('Failed to start daemon');
    process.exit(1);
  }

  child.unref();
  await writePid(child.pid);
  console.log(`Daemon started (PID: ${child.pid})`);
}

async function handleStop(): Promise<void> {
  const pid = await readPid();
  if (!pid) {
    console.log('Daemon is not running (no PID file)');
    return;
  }

  if (!isProcessAlive(pid)) {
    console.log(`Daemon process ${pid} is not running, cleaning up PID file`);
    await removePid();
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Sent SIGTERM to daemon (PID: ${pid})`);

    // 等待 process 結束
    const stopped = await waitForProcessExit(pid, 5000);
    if (stopped) {
      console.log('Daemon stopped');
    } else {
      process.kill(pid, 'SIGKILL');
      console.log('Daemon force killed');
    }
  } catch {
    console.log('Daemon process not found');
  }

  await removePid();
}

async function handleStatus(): Promise<void> {
  const pid = await readPid();
  if (!pid) {
    console.log('Daemon is not running');
    return;
  }

  if (!isProcessAlive(pid)) {
    console.log(`Daemon PID ${pid} is stale (process not running)`);
    return;
  }

  console.log(`Daemon is running (PID: ${pid})`);

  // 嘗試查詢 health endpoint
  try {
    const resp = await fetch('http://localhost:7777/health');
    const health = await resp.json();
    console.log('Health:', JSON.stringify(health, null, 2));
  } catch {
    console.log('Could not reach daemon health endpoint');
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForProcessExit(
  pid: number,
  timeoutMs: number
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isProcessAlive(pid)) return true;
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

async function readPid(): Promise<number | null> {
  try {
    const content = await readFile(PID_FILE, 'utf-8');
    const pid = parseInt(content.trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function writePid(pid: number): Promise<void> {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(PID_FILE, String(pid), 'utf-8');
}

async function removePid(): Promise<void> {
  try {
    await unlink(PID_FILE);
  } catch {
    // PID file already gone
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
