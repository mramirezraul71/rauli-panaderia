/**
 * GENESIS - Backend Server
 * Sistema de Gesti�n Integral para negocios
 * Arquitectura Offline-First
 */

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Importar rutas
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import salesRoutes from './routes/sales.js';
import inventoryRoutes from './routes/inventory.js';
import accountingRoutes from './routes/accounting.js';
import employeesRoutes from './routes/employees.js';
import syncRoutes from './routes/sync.js';
import reportsRoutes from './routes/reports.js';
import predictionsRoutes from './routes/predictions.js';
import sentinelRoutes from './routes/sentinel.js';
import productionRoutes from './routes/production.js';
import openaiProxyRoutes from './routes/openaiProxy.js';
import invitesRoutes from './routes/invites.js';

// Cargar variables de entorno (forzar .env del backend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
const smtpConfigured = Boolean(process.env.SMTP_HOST);
const smtpFromConfigured = Boolean(process.env.SMTP_FROM || process.env.SMTP_USER);
console.log(`[ENV] SMTP_HOST: ${smtpConfigured ? 'ok' : 'missing'}, SMTP_FROM/USER: ${smtpFromConfigured ? 'ok' : 'missing'}`);

// Configuraci�n
const app = express();
const PORT = process.env.PORT || 3001;

// CORS: permitir origen del frontend en producción
const corsOrigin = process.env.CORS_ORIGIN;
const corsOptions = corsOrigin
  ? { origin: corsOrigin.split(',').map((o) => o.trim()), credentials: true }
  : {};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Raíz: evitar 404 en GET / (p. ej. health checks que apuntan a la base URL)
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'GENESIS API',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Health check (versión permite verificar que el backend se actualizó)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: pkg.version || '1.0.0',
    name: 'GENESIS API'
  });
});

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/predictions', predictionsRoutes);
app.use('/api/sentinel', sentinelRoutes);
app.use('/api/production', productionRoutes);
app.use('/api/ai', openaiProxyRoutes);
app.use('/api/invites', invitesRoutes);

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: true, message: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
���������������������������������������������������������������ͻ
�   �����ۻ  ����ۻ �ۻ   �ۻ�ۻ     �ۻ    ������ۻ�����ۻ �����ۻ �
�   ������ۻ������ۻ�ۺ   �ۺ�ۺ     �ۺ    ������ͼ������ۻ������ۻ�
�   ������ɼ������ۺ�ۺ   �ۺ�ۺ     �ۺ    ����ۻ  ������ɼ������ɼ�
�   ������ۻ������ۺ�ۺ   �ۺ�ۺ     �ۺ    ����ͼ  ������ۻ�����ͼ �
�   �ۺ  �ۺ�ۺ  �ۺ�������ɼ������ۻ�ۺ    ������ۻ�ۺ  �ۺ�ۺ     �
�   �ͼ  �ͼ�ͼ  �ͼ �����ͼ ������ͼ�ͼ    ������ͼ�ͼ  �ͼ�ͼ     �
���������������������������������������������������������������ͼ
  Sistema de Gesti�n Integral para negocios

  [�] Servidor iniciado en puerto ${PORT}
  [�] API disponible en http://localhost:${PORT}/api
  [�] Health check: http://localhost:${PORT}/api/health

  Para acceso desde dispositivos m�viles:
  Usar IP local de este equipo (ej: 192.168.1.x:${PORT})
  `);
});

export default app;
