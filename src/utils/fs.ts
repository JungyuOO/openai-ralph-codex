import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(p: string): Promise<void> {
  await fs.mkdir(p, { recursive: true });
}

export async function readTextUtf8(p: string): Promise<string> {
  return fs.readFile(p, 'utf8');
}

export async function writeTextUtf8(p: string, data: string): Promise<void> {
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, data, 'utf8');
}

export async function readJson<T>(p: string): Promise<T> {
  const text = await readTextUtf8(p);
  return JSON.parse(text) as T;
}

export async function writeJson(p: string, data: unknown): Promise<void> {
  await writeTextUtf8(p, JSON.stringify(data, null, 2) + '\n');
}

export async function copyIfMissing(src: string, dest: string): Promise<boolean> {
  if (await exists(dest)) return false;
  const content = await readTextUtf8(src);
  await writeTextUtf8(dest, content);
  return true;
}
