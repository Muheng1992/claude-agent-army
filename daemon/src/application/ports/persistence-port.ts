// src/application/ports/persistence-port.ts

export interface PersistencePort {
  readJson<T>(filePath: string): Promise<T | null>;
  writeJson<T>(filePath: string, data: T): Promise<void>;
  readFile(filePath: string): Promise<string | null>;
  writeFile(filePath: string, content: string): Promise<void>;
  ensureDir(dirPath: string): Promise<void>;
  listFiles(dirPath: string): Promise<string[]>;
  exists(filePath: string): Promise<boolean>;
}
