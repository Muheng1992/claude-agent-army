// src/adapters/file-persistence.ts
// WHY: 低階檔案 I/O adapter，提供 atomic write 確保資料一致性

import { readFile, writeFile, mkdir, readdir, access, rename } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import type { PersistencePort } from '../application/ports/persistence-port.js';

export class FilePersistence implements PersistencePort {
  async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as T;
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async writeJson<T>(filePath: string, data: T): Promise<void> {
    await this.ensureDir(dirname(filePath));
    const content = JSON.stringify(data, null, 2);
    await this.atomicWrite(filePath, content);
  }

  async readFile(filePath: string): Promise<string | null> {
    try {
      return await readFile(filePath, 'utf-8');
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    await this.ensureDir(dirname(filePath));
    await this.atomicWrite(filePath, content);
  }

  async ensureDir(dirPath: string): Promise<void> {
    await mkdir(dirPath, { recursive: true });
  }

  async listFiles(dirPath: string): Promise<string[]> {
    try {
      const entries = await readdir(dirPath);
      return entries.map((entry) => join(dirPath, entry));
    } catch (err) {
      if (isNodeError(err) && err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /** Atomic write: 寫入 .tmp 檔再 rename，避免寫入中斷造成資料損毀 */
  private async atomicWrite(
    filePath: string,
    content: string
  ): Promise<void> {
    const tmpPath = `${filePath}.${randomBytes(4).toString('hex')}.tmp`;
    await writeFile(tmpPath, content, 'utf-8');
    await rename(tmpPath, filePath);
  }
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
