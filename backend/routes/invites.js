/**
 * RAULI - Invitaciones por rol (circuito cerrado)
 * El dueño genera códigos desde su pantalla; los integrantes entran por enlace (navegador) y quedan registrados con ese rol.
 */

import { Router } from 'express';
import db from '../database/connection.js';

const TABLE = 'role_invites';

const ensureTable = () => {
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','used','revoked')),
        used_at TEXT,
        used_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `).run();
  } catch (err) {
    console.error('Error ensuring role_invites table:', err);
  }
};

const randomCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

const router = Router();
ensureTable();

// POST /api/invites - Crear invitación (dueño). Body: { role }
router.post('/', (req, res) => {
  try {
    ensureTable();
    const { role = 'cajero' } = req.body;
    let code = randomCode();
    let exists = db.prepare(`SELECT 1 FROM ${TABLE} WHERE code = ?`).get(code);
    while (exists) {
      code = randomCode();
      exists = db.prepare(`SELECT 1 FROM ${TABLE} WHERE code = ?`).get(code);
    }
    db.prepare(
      `INSERT INTO ${TABLE} (code, role, status) VALUES (?, ?, 'pending')`
    ).run(code, String(role).trim().toLowerCase());
    const row = db.prepare(`SELECT * FROM ${TABLE} WHERE code = ?`).get(code);
    res.status(201).json({
      success: true,
      invite: {
        id: row.id,
        code: row.code,
        role: row.role,
        status: row.status,
        created_at: row.created_at
      }
    });
  } catch (err) {
    console.error('POST /api/invites', err);
    res.status(500).json({ error: true, message: 'Error al crear invitación' });
  }
});

// GET /api/invites - Listar invitaciones (dueño)
router.get('/', (req, res) => {
  try {
    ensureTable();
    const rows = db.prepare(
      `SELECT id, code, role, status, used_at, used_by, created_at FROM ${TABLE} ORDER BY created_at DESC`
    ).all();
    res.json({ success: true, invites: rows });
  } catch (err) {
    console.error('GET /api/invites', err);
    res.status(500).json({ error: true, message: 'Error al listar invitaciones' });
  }
});

// GET /api/invites/validate?code=XXX - Validar código (público, para pantalla de entrada)
router.get('/validate', (req, res) => {
  try {
    const code = (req.query.code || '').trim().toUpperCase();
    if (!code) {
      return res.json({ valid: false, message: 'Código requerido' });
    }
    const row = db.prepare(
      `SELECT code, role, status FROM ${TABLE} WHERE code = ?`
    ).get(code);
    if (!row) {
      return res.json({ valid: false, message: 'Código no existe' });
    }
    if (row.status !== 'pending') {
      return res.json({ valid: false, message: 'Código ya usado o revocado' });
    }
    res.json({ valid: true, role: row.role });
  } catch (err) {
    console.error('GET /api/invites/validate', err);
    res.status(500).json({ valid: false, message: 'Error al validar' });
  }
});

// POST /api/invites/use - Marcar código como usado. Body: { code, used_by? }
router.post('/use', (req, res) => {
  try {
    const { code: raw, used_by = '' } = req.body;
    const code = (raw || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: true, message: 'Código requerido' });
    }
    const row = db.prepare(`SELECT id, status FROM ${TABLE} WHERE code = ?`).get(code);
    if (!row) {
      return res.status(404).json({ error: true, message: 'Código no existe' });
    }
    if (row.status !== 'pending') {
      return res.status(400).json({ error: true, message: 'Código ya usado o revocado' });
    }
    db.prepare(
      `UPDATE ${TABLE} SET status = 'used', used_at = datetime('now'), used_by = ? WHERE id = ?`
    ).run(String(used_by).trim() || null, row.id);
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/invites/use', err);
    res.status(500).json({ error: true, message: 'Error al marcar uso' });
  }
});

// PATCH /api/invites/:code/revoke - Revocar invitación (dueño)
router.patch('/:code/revoke', (req, res) => {
  try {
    const code = (req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: true, message: 'Código requerido' });
    const row = db.prepare(`SELECT id, status FROM ${TABLE} WHERE code = ?`).get(code);
    if (!row) return res.status(404).json({ error: true, message: 'Código no existe' });
    if (row.status !== 'pending') {
      return res.json({ success: true, message: 'Ya estaba usado o revocado' });
    }
    db.prepare(`UPDATE ${TABLE} SET status = 'revoked' WHERE id = ?`).run(row.id);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH /api/invites/revoke', err);
    res.status(500).json({ error: true, message: 'Error al revocar' });
  }
});

export default router;
