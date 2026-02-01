# Auditoría Técnica y Contable — GENESIS

Fecha: 2026-01-25  
Rol: Arquitecto de Software Senior + Auditor Financiero (CPA)

## Resumen ejecutivo
GENESIS tiene una base funcional sólida (POS, Inventario, RRHH, Contabilidad básica, Analítica). Sin embargo, para competir con líderes globales (SAP B1, QuickBooks, Square), hoy hay brechas críticas en **validación server‑side**, **precisión financiera**, **conciliación bancaria real** y **gobernanza de datos contables**. Ya corregí puntos críticos de seguridad y precisión en ventas y dejé estructurado el Libro Mayor.

---

## FASE 1 — Benchmarking de Mercado

### 1) Comparativa de features (brechas vs líderes)
**Faltantes críticos/estratégicos:**
- Conciliación bancaria automática real (con matching, reglas y conciliación por extractos).
- Activos fijos (alta/baja, depreciación, vida útil, revalorización).
- Cuentas por cobrar y pagar robustas (AP/AR con aging, límites de crédito, intereses).
- Compras/abastecimiento (PO → recepción → factura).
- Multi‑empresa / multi‑sucursal / multi‑moneda con consolidación.
- Cumplimiento fiscal local (libros electrónicos, retenciones, e‑invoicing).

### 2) Estándar de UX (regla de “máximo 3 clics”)
La arquitectura por tabs reduce fricción en módulos grandes (Contabilidad, RRHH).  
En flujos principales (POS → cobro → venta) se cumple. En configuración avanzada y reportes, se requieren más de 3 clics y no hay búsqueda global ni atajos para navegación contextual.

### 3) Reporte de brechas (Top 3 que impiden escalar)
1. **Validación server‑side y antifraude de precios**: el backend aceptaba totales y precios del cliente.  
2. **Precisión financiera y redondeos**: uso extensivo de `float/REAL` sin normalización global.  
3. **Contabilidad incompleta y conciliación**: gastos no pasan por backend; falta conciliación bancaria real y un Libro Mayor formal.

---

## FASE 2 — Certificación Contable y Rigor

### 1) Principio de Partida Doble
**Estado actual:**
- Ventas generan asientos contables en backend (`createSaleEntry`).
- Costos de venta y comisiones existen en servicios contables pero no están conectados consistentemente.
- Gastos: se registran solo en frontend/local (sin asiento y sin validación server‑side).

**Acción aplicada:**  
Se corrigió la creación de asientos en ventas (uso correcto de objeto `sale`) y se aseguró la estructura de Libro Mayor.

**Propuesta de estructura Libro Mayor:**
- Tabla `general_ledger` y vista `general_ledger_view` (derivada de `journal_lines` + `journal_entries` + `accounts`).

### 2) Manejo de Decimales
**Riesgo:** uso de `float/REAL` y operaciones nativas (`Number`, `parseFloat`) puede generar desbalances.  
**Acción aplicada:** redondeo consistente a 2 decimales en el backend para cálculo de ventas (líneas, subtotal, impuesto, total).  
**Recomendación:** migrar a:
- Representación en centavos (`INTEGER`) **o**
- Librería de precisión (`decimal.js` / `big.js`) para cálculos contables críticos.

### 3) Inmutabilidad
**Estado actual:**
- Ventas se “cancelan” por estado (no se borran físicamente).
- Existe `reverseEntry()` para reversos contables, pero no se aplica en cancelaciones de ventas.

**Recomendación:** al cancelar una venta, generar un contra‑asiento automático para trazabilidad completa.

---

## FASE 3 — Inspección de Código (Deep Scan)

### 1) Deuda Técnica
- **Doble motor contable** (frontend `AccountingCore` y backend `accounting.js`) con reglas divergentes.
- **Códigos de cuentas inconsistentes** (ej. backend usa `1101/1102`, seed usa `1100/1200`).
- **Ausencia de migraciones**: cambios de esquema solo en `init.js` (no actualiza instancias existentes).

### 2) Seguridad de Datos (validación server‑side)
**Riesgo detectado:** el backend aceptaba precios/totales enviados desde frontend.  
**Corrección aplicada:** cálculo y validación server‑side de precios, impuestos, descuentos y totales.

---

## Acciones correctivas aplicadas (automáticas)

1. **Blindaje de precios y totales en ventas**
   - Backend recalcula `subtotal`, `tax`, `total` y líneas usando precios del producto.
   - Rechaza cantidades inválidas y productos inactivos.
2. **Normalización de redondeos**
   - Redondeo a 2 decimales en cálculos de venta y comisiones.
3. **Libro Mayor**
   - Estructura `general_ledger` y vista `general_ledger_view`.
   - Inicialización automática en el servicio contable.

---

## Action Plan (prioridad alta → media)

**Alta**
- Conectar cancelación de venta con contra‑asiento contable.
- Implementar endpoint backend de **gastos** con validación y asiento automático.
- Migrar aritmética financiera a centavos o `decimal.js`.

**Media**
- Conciliación bancaria real con reglas y matching.
- Activos fijos con depreciación.
- Módulo AP/AR robusto (aging, límites, intereses).

---

## Evidencia de cambios en código

Archivos clave modificados:
- `backend/routes/sales.js` (cálculo y validación server‑side, redondeos)
- `backend/services/accounting.js` (estructura Libro Mayor)
- `backend/database/init.js` (tabla y vista de Libro Mayor)

