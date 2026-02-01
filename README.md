# 🧩 GENESIS

Sistema de Gestión Integral para negocios con arquitectura offline-first.

## ✨ Características

### Módulos Implementados

- **📊 Dashboard** - Resumen de ventas, métricas y alertas
- **🛒 Punto de Venta (POS)** - Terminal de venta con soporte offline
- **📦 Productos** - Gestión de catálogo con categorías y precios
- **📋 Inventario** - Control de lotes, movimientos, recetas y producción
- **💰 Ventas** - Historial, sesiones de caja y analíticas
- **👥 Empleados** - HR, horarios, comisiones y nómina
- **📒 Contabilidad** - Plan de cuentas, libro diario, bancos y estados financieros
- **📈 Reportes** - Reportes avanzados con análisis de IA
- **⚙️ Configuración** - Ajustes del sistema y sincronización

### Tecnologías

**Frontend:**
- React 18 + Vite
- TailwindCSS
- React Query (TanStack)
- React Router DOM
- Dexie.js (IndexedDB)
- PWA con Service Worker

**Backend:**
- Node.js + Express
- SQLite con WAL mode
- JWT Authentication
- REST API

## 🚀 Instalación

### Requisitos
- Node.js 18+
- npm o yarn

### Pasos

```bash
# Clonar el repositorio
git clone <repo-url>
cd genesis-erp

# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install
```

## 💻 Desarrollo

### Opción 1: Script de desarrollo (recomendado)

```bash
# Desde la raíz del proyecto
chmod +x start-dev.sh
./start-dev.sh
```

### Opción 2: Iniciar manualmente

```bash
# Terminal 1 - Backend
cd backend
npm run dev
# Servidor en http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev
# App en http://localhost:5173
```

## 👤 Usuarios de Prueba

| Usuario | Contraseña | Rol |
|---------|------------|-----|
| admin@genesis.com | admin123 | Administrador |
| gerente@genesis.com | gerente123 | Gerente |
| cajero@genesis.com | cajero123 | Cajero |

## 📁 Estructura del Proyecto

```
genesis-erp/
├── backend/
│   ├── database/
│   │   └── init.js          # Esquema y datos iniciales
│   ├── routes/
│   │   ├── auth.js          # Autenticación
│   │   ├── products.js      # Productos y categorías
│   │   ├── sales.js         # Ventas y sesiones
│   │   ├── inventory.js     # Inventario y lotes
│   │   ├── employees.js     # Empleados y nómina
│   │   ├── accounting.js    # Contabilidad
│   │   ├── reports.js       # Reportes
│   │   ├── sync.js          # Sincronización
│   │   └── predictions.js   # Predicciones IA
│   ├── services/
│   │   └── accounting.js    # Lógica contable
│   └── server.js            # Servidor Express
│
├── frontend/
│   ├── public/
│   │   ├── sw.js            # Service Worker
│   │   ├── manifest.json    # PWA Manifest
│   │   └── icon.svg         # Icono de la app
│   └── src/
│       ├── components/
│       │   └── ConnectionStatus.jsx
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── SyncContext.jsx
│       ├── db/
│       │   └── localDB.js   # IndexedDB (Dexie)
│       ├── layouts/
│       │   ├── MainLayout.jsx
│       │   └── AuthLayout.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── POS.jsx
│       │   ├── Products.jsx
│       │   ├── Inventory.jsx
│       │   ├── Sales.jsx
│       │   ├── Employees.jsx
│       │   ├── Accounting.jsx
│       │   ├── Reports.jsx
│       │   ├── Settings.jsx
│       │   └── Login.jsx
│       ├── services/
│       │   ├── api.js       # Cliente API
│       │   └── syncService.js
│       ├── App.jsx
│       └── main.jsx
│
├── start-dev.sh             # Script de desarrollo
└── README.md
```

## 📱 PWA y Modo Offline

La aplicación funciona como PWA con soporte offline completo:

- **Service Worker** - Cache de assets y API responses
- **IndexedDB** - Almacenamiento local de datos
- **Background Sync** - Sincronización automática al reconectar
- **Manifest** - Instalable en dispositivos móviles

### Instalación como App

1. Abrir la app en Chrome/Edge
2. Click en "Instalar" en la barra de direcciones
3. La app se instalará como aplicación nativa

## 🔧 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Productos
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto
- `PUT /api/products/:id` - Actualizar producto
- `DELETE /api/products/:id` - Eliminar producto

### Ventas
- `GET /api/sales` - Historial de ventas
- `POST /api/sales` - Crear venta
- `GET /api/sales/sessions` - Sesiones de caja
- `POST /api/sales/sessions/open` - Abrir caja
- `POST /api/sales/sessions/close` - Cerrar caja

### Inventario
- `GET /api/inventory/summary` - Resumen
- `GET /api/inventory/lots` - Lotes
- `POST /api/inventory/lots` - Crear lote
- `GET /api/inventory/movements` - Movimientos
- `POST /api/inventory/adjustment` - Ajuste de stock

### Empleados
- `GET /api/employees` - Listar empleados
- `POST /api/employees` - Crear empleado
- `GET /api/employees/schedules` - Horarios
- `GET /api/employees/commissions` - Comisiones
- `GET /api/employees/payroll` - Nómina

### Contabilidad
- `GET /api/accounting/accounts` - Plan de cuentas
- `GET /api/accounting/entries` - Libro diario
- `GET /api/accounting/bank-accounts` - Cuentas bancarias
- `GET /api/accounting/balance-sheet` - Balance general
- `GET /api/accounting/income-statement` - Estado de resultados

### Reportes
- `GET /api/reports/sales-by-product` - Ventas por producto
- `GET /api/reports/sales-by-employee` - Ventas por empleado
- `GET /api/reports/inventory-status` - Estado del inventario
- `GET /api/reports/employee-performance` - Rendimiento empleados

## 🔒 Seguridad

- Autenticación JWT con tokens de corta duración
- Contraseñas hasheadas con bcrypt
- Validación de roles en cada endpoint
- CORS configurado para dominios específicos

## 📊 Base de Datos

SQLite con modo WAL para mejor rendimiento:

- **users** - Usuarios del sistema
- **products** - Catálogo de productos
- **categories** - Categorías de productos
- **sales** - Ventas
- **sale_items** - Items de venta
- **cash_sessions** - Sesiones de caja
- **inventory_lots** - Lotes de inventario
- **inventory_movements** - Movimientos de stock
- **employees** - Empleados
- **shifts** - Turnos
- **schedules** - Horarios asignados
- **commissions** - Comisiones
- **payroll** - Nómina
- **accounts** - Plan de cuentas
- **journal_entries** - Asientos contables
- **bank_accounts** - Cuentas bancarias
- **settings** - Configuración

## 🎨 Temas y Diseño

- Tema oscuro (Slate/Purple)
- Diseño responsive mobile-first
- Fuentes: Inter, Poppins, JetBrains Mono
- Iconos: Heroicons (react-icons/hi)

## 🤖 Robot ATLAS (rauli-panaderia)

Bot de Telegram para despliegues, capturas y comprobación. Ver **[robot/README.md](robot/README.md)**.

- `/ping`, `/captura` — Comprobar bot y recibir captura de la app
- Voz: «Despliega la panadería» — Vercel + Render
- `robot_preparar_todo.bat` — Instalar todo y comprobar bot

## 📝 Licencia

MIT License - Desarrollado para GENESIS

---

Desarrollado con ❤️ por Claude AI para GENESIS
