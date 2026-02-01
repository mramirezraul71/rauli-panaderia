/**
 * GENESIS - Database Connection Module
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configuredPath = process.env.DATABASE_PATH || process.env.DB_PATH;
const legacyPath = join(__dirname, 'rauli.db');
const defaultPath = join(__dirname, 'genesis.db');
const dbPath = configuredPath || (existsSync(legacyPath) ? legacyPath : defaultPath);
const db = new Database(dbPath);

// Configuraciones de optimización
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export default db;
