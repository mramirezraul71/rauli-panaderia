/**
 * GENESIS - Authentication Routes
 */

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../database/connection.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'genesis-erp-secret-key-2024';

// Middleware de autenticación
export const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: true, message: 'Token requerido' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: true, message: 'Token inválido' });
  }
};

// Middleware opcional: intenta autenticar, pero no bloquea si no hay token
export const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch {}
  return next();
};

// Middleware de roles
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: true, message: 'Acceso denegado' });
    }
    next();
  };
};

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: true, message: 'Usuario y contraseña requeridos' });
    }
    
    const user = db.prepare(`
      SELECT id, username, password_hash, name, role, active
      FROM users WHERE username = ?
    `).get(username);
    
    if (!user) {
      return res.status(401).json({ error: true, message: 'Credenciales inválidas' });
    }
    
    if (!user.active) {
      return res.status(401).json({ error: true, message: 'Usuario desactivado' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: true, message: 'Credenciales inválidas' });
    }
    
    // Generar token
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Guardar sesión
    const sessionId = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    db.prepare(`
      INSERT INTO sessions (id, user_id, token, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, user.id, token, expiresAt);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, message: 'Sesión cerrada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, name, role, active, created_at
      FROM users WHERE id = ?
    `).get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: true, message: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

// PUT /api/auth/password
router.put('/password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: true, message: 'Contraseña actual incorrecta' });
    }
    
    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?')
      .run(newHash, req.user.id);
    
    res.json({ success: true, message: 'Contraseña actualizada' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

// GET /api/auth/users (admin only)
router.get('/users', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, username, name, role, active, created_at, updated_at
      FROM users ORDER BY name
    `).all();
    
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

// POST /api/auth/users (admin only)
router.post('/users', authMiddleware, requireRole('admin'), (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: true, message: 'Usuario ya existe' });
    }
    
    const id = uuidv4();
    const hash = bcrypt.hashSync(password, 10);
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, hash, name, role);
    
    res.status(201).json({ success: true, id, message: 'Usuario creado' });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error de servidor' });
  }
});

export default router;
