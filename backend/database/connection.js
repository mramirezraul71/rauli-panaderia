/**
 * GENESIS - Database Connection Module
 */

import Database from 'better-sqlite3';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, isAbsolute, join, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configuredPath = process.env.DATABASE_PATH || process.env.DB_PATH;
const legacyPath = join(__dirname, 'rauli.db');
const defaultPath = join(__dirname, 'genesis.db');
const dbPath = configuredPath
  ? (isAbsolute(configuredPath) ? configuredPath : resolve(process.cwd(), configuredPath))
  : (existsSync(legacyPath) ? legacyPath : defaultPath);

const CORE_TABLES = [
  'users',
  'accounts',
  'journal_entries',
  'journal_lines',
  'sales',
  'employees',
  'settings',
  'bank_accounts'
];

function hasCoreSchema(path) {
  try {
    const probe = new Database(path);
    const rows = probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    probe.close();
    const names = new Set(rows.map((row) => row.name));
    return CORE_TABLES.every((table) => names.has(table));
  } catch {
    return false;
  }
}

function runBootstrapIfNeeded(path) {
  if (hasCoreSchema(path)) return;
  const initScript = join(__dirname, 'init.js');
  console.warn(`[DB] Core schema missing at ${path}. Running bootstrap init...`);
  const result = spawnSync(process.execPath, [initScript], {
    cwd: __dirname,
    env: {
      ...process.env,
      DATABASE_PATH: path,
      DB_PATH: path
    },
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    console.error('[DB] Bootstrap init failed');
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
}

runBootstrapIfNeeded(dbPath);

const db = new Database(dbPath);

// Optimizations
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export default db;
