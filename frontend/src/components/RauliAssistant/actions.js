import { db } from "../../services/dataService";
import SyncService from "../../services/syncService";
import cashSession from "../../core/CashSession";
import accountingCore from "../../core/AccountingCore";

const API_BASE = "/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
};

const apiFetch = async (path, options = {}) => {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...getAuthHeaders(), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, data: {}, offline: true, error };
  }
};

const requiresAuth = (status) => status === 401 || status === 403;
const isOffline = (api) => !navigator.onLine || api?.offline;

const queueOfflineOperation = async (entityType, operation, data) => {
  await SyncService.queueOperation(entityType, operation, data);
};

const findLocalProductByName = async (productName) => {
  const list = await db.products?.where("active").equals(1).toArray();
  const term = String(productName || "").toLowerCase();
  return list?.find((p) => String(p.name || "").toLowerCase() === term);
};

const summarizeList = (items, limit = 5, labelKey = "name") => {
  if (!items || items.length === 0) return "Sin datos.";
  return items
    .slice(0, limit)
    .map((item) => String(item[labelKey] || item.id || "item"))
    .join(", ");
};

const buildSaleSummary = (items) => {
  const lines = items.map((item) => {
    const qty = item.quantity || 0;
    const price = Number(item.unit_price || 0);
    const total = Math.round((qty * price + Number.EPSILON) * 100) / 100;
    return `${qty} x ${item.product_name} = ${total}`;
  });
  const subtotal = items.reduce((sum, item) => {
    const qty = item.quantity || 0;
    const price = Number(item.unit_price || 0);
    return sum + qty * price;
  }, 0);
  const total = Math.round((subtotal + Number.EPSILON) * 100) / 100;
  return { lines, total };
};

const formatSaleConfirmation = (saleItems, total) => {
  const totalItems = saleItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const account = "4100 - Ventas de Mercancías";
  return [
    "Perfecto, voy a registrar la venta.",
    `Resumen: ${totalItems} unidades en total.`,
    `Total: ${total}.`,
    `Se guardará en las ventas del día y se reportará como ingreso en la cuenta ${account}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatSaleResult = (saleItems, total) => {
  const totalItems = saleItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const account = "4100 - Ventas de Mercancías";
  return [
    "Venta registrada correctamente.",
    `Resumen: ${totalItems} unidades en total.`,
    `Total: ${total}.`,
    `Se guardó en las ventas del día y se reportó en la cuenta ${account}.`
  ].join("\n");
};

const formatExpenseConfirmation = ({ amount, description, category, paymentMethod, accountCode }) => {
  const expenseAccount = accountCode || "6900 - Otros Gastos";
  const paymentAccount = paymentMethod === "tarjeta" || paymentMethod === "transferencia"
    ? "1120 - Bancos"
    : "1100 - Caja General";
  return [
    "Perfecto, voy a registrar el gasto.",
    `Descripción: ${description || category || "Gasto"}.`,
    `Monto: ${amount}.`,
    `Cuenta de gasto: ${expenseAccount}.`,
    `Salida registrada desde: ${paymentAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatExpenseResult = ({ amount, description, category, paymentMethod, accountCode }) => {
  const expenseAccount = accountCode || "6900 - Otros Gastos";
  const paymentAccount = paymentMethod === "tarjeta" || paymentMethod === "transferencia"
    ? "1120 - Bancos"
    : "1100 - Caja General";
  return [
    "Gasto registrado correctamente.",
    `Descripción: ${description || category || "Gasto"}.`,
    `Monto: ${amount}.`,
    `Cuenta de gasto: ${expenseAccount}.`,
    `Salida registrada desde: ${paymentAccount}.`
  ].join("\n");
};

const formatInventoryAdjustmentConfirmation = ({ productName, quantity, direction, reason }) => {
  const inventoryAccount = "1300 - Inventario";
  const offsetAccount = direction === "in"
    ? "5100 - Costo de Ventas"
    : "6900 - Otros Gastos";
  const directionLabel = direction === "in" ? "aumentar" : "disminuir";
  return [
    "Perfecto, voy a registrar el ajuste de inventario.",
    `Producto: ${productName}.`,
    `Cantidad: ${quantity} (${directionLabel}).`,
    `Motivo: ${reason || "Ajuste manual"}.`,
    `Cuenta inventario: ${inventoryAccount}.`,
    `Cuenta contraparte: ${offsetAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatInventoryAdjustmentResult = ({ productName, quantity, direction, reason }) => {
  const inventoryAccount = "1300 - Inventario";
  const offsetAccount = direction === "in"
    ? "5100 - Costo de Ventas"
    : "6900 - Otros Gastos";
  const directionLabel = direction === "in" ? "aumento" : "disminución";
  return [
    "Ajuste de inventario registrado.",
    `Producto: ${productName}.`,
    `Cantidad: ${quantity} (${directionLabel}).`,
    `Motivo: ${reason || "Ajuste manual"}.`,
    `Cuenta inventario: ${inventoryAccount}.`,
    `Cuenta contraparte: ${offsetAccount}.`
  ].join("\n");
};

const formatPurchaseConfirmation = ({ amount, description, paymentMethod }) => {
  const costAccount = "5100 - Costo de Ventas";
  const paymentAccount = paymentMethod === "tarjeta" || paymentMethod === "transferencia"
    ? "1120 - Bancos"
    : "1100 - Caja General";
  return [
    "Perfecto, voy a registrar la compra.",
    `Descripción: ${description || "Compra"}.`,
    `Monto: ${amount}.`,
    `Cuenta de costo: ${costAccount}.`,
    `Salida registrada desde: ${paymentAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatPurchaseResult = ({ amount, description, paymentMethod }) => {
  const costAccount = "5100 - Costo de Ventas";
  const paymentAccount = paymentMethod === "tarjeta" || paymentMethod === "transferencia"
    ? "1120 - Bancos"
    : "1100 - Caja General";
  return [
    "Compra registrada correctamente.",
    `Descripción: ${description || "Compra"}.`,
    `Monto: ${amount}.`,
    `Cuenta de costo: ${costAccount}.`,
    `Salida registrada desde: ${paymentAccount}.`
  ].join("\n");
};

const formatCashMovementConfirmation = ({ amount, description, direction }) => {
  const account = "1100 - Caja General";
  const label = direction === "in" ? "entrada de efectivo" : "salida de efectivo";
  return [
    `Perfecto, voy a registrar una ${label}.`,
    `Monto: ${amount}.`,
    `Descripción: ${description || "Movimiento de caja"}.`,
    `Cuenta afectada: ${account}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatCashMovementResult = ({ amount, description, direction }) => {
  const account = "1100 - Caja General";
  const label = direction === "in" ? "Entrada" : "Salida";
  return [
    `${label} de efectivo registrada correctamente.`,
    `Monto: ${amount}.`,
    `Descripción: ${description || "Movimiento de caja"}.`,
    `Cuenta afectada: ${account}.`
  ].join("\n");
};

const formatCashSessionConfirmation = ({ amount, direction }) => {
  const account = "1100 - Caja General";
  const label = direction === "open" ? "apertura de caja" : "cierre de caja";
  return [
    `Perfecto, voy a registrar la ${label}.`,
    `Monto: ${amount}.`,
    `Cuenta afectada: ${account}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatCashSessionResult = ({ amount, direction }) => {
  const account = "1100 - Caja General";
  const label = direction === "open" ? "Apertura" : "Cierre";
  return [
    `${label} de caja registrada.`,
    `Monto: ${amount}.`,
    `Cuenta afectada: ${account}.`
  ].join("\n");
};

const formatCreditPaymentConfirmation = ({ amount, customerName }) => {
  const debitAccount = "1100 - Caja General";
  const creditAccount = "1200 - Cuentas por Cobrar";
  return [
    "Perfecto, voy a registrar un cobro de crédito.",
    `Cliente: ${customerName || "Cliente"}.`,
    `Monto: ${amount}.`,
    `Cuenta caja: ${debitAccount}.`,
    `Cuenta por cobrar: ${creditAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatCreditPaymentResult = ({ amount, customerName }) => {
  const debitAccount = "1100 - Caja General";
  const creditAccount = "1200 - Cuentas por Cobrar";
  return [
    "Cobro de crédito registrado.",
    `Cliente: ${customerName || "Cliente"}.`,
    `Monto: ${amount}.`,
    `Cuenta caja: ${debitAccount}.`,
    `Cuenta por cobrar: ${creditAccount}.`
  ].join("\n");
};

const formatCreditNoteConfirmation = ({ amount, customerName, paymentMethod, reason }) => {
  const debitAccount = "4110 - Devoluciones sobre Ventas";
  const creditAccount = paymentMethod === "credito"
    ? "1200 - Cuentas por Cobrar"
    : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
      ? "1120 - Bancos"
      : "1100 - Caja General";
  return [
    "Perfecto, voy a registrar una nota de crédito.",
    `Cliente: ${customerName || "Cliente"}.`,
    `Monto: ${amount}.`,
    `Motivo: ${reason || "Devolución/ajuste"}.`,
    `Cuenta devolución: ${debitAccount}.`,
    `Cuenta aplicada: ${creditAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatCreditNoteResult = ({ amount, customerName, paymentMethod, reason }) => {
  const debitAccount = "4110 - Devoluciones sobre Ventas";
  const creditAccount = paymentMethod === "credito"
    ? "1200 - Cuentas por Cobrar"
    : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
      ? "1120 - Bancos"
      : "1100 - Caja General";
  return [
    "Nota de crédito registrada.",
    `Cliente: ${customerName || "Cliente"}.`,
    `Monto: ${amount}.`,
    `Motivo: ${reason || "Devolución/ajuste"}.`,
    `Cuenta devolución: ${debitAccount}.`,
    `Cuenta aplicada: ${creditAccount}.`
  ].join("\n");
};

const formatPartialRefundConfirmation = ({ amount, saleId, paymentMethod }) => {
  const debitAccount = "4110 - Devoluciones sobre Ventas";
  const creditAccount = paymentMethod === "credito"
    ? "1200 - Cuentas por Cobrar"
    : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
      ? "1120 - Bancos"
      : "1100 - Caja General";
  return [
    `Vas a registrar una devolución parcial de la venta ${saleId}.`,
    `Monto: ${amount}.`,
    `Cuenta devolución: ${debitAccount}.`,
    `Cuenta aplicada: ${creditAccount}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatPartialRefundResult = ({ amount, saleId, paymentMethod }) => {
  const debitAccount = "4110 - Devoluciones sobre Ventas";
  const creditAccount = paymentMethod === "credito"
    ? "1200 - Cuentas por Cobrar"
    : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
      ? "1120 - Bancos"
      : "1100 - Caja General";
  return [
    `Devolución parcial registrada para la venta ${saleId}.`,
    `Monto: ${amount}.`,
    `Cuenta devolución: ${debitAccount}.`,
    `Cuenta aplicada: ${creditAccount}.`
  ].join("\n");
};

const formatCashVarianceConfirmation = ({ expected, counted, difference }) => {
  const account = "1100 - Caja General";
  const adjustment = "3999 - Ajustes por Diferencias";
  const label = difference > 0 ? "sobrante" : "faltante";
  return [
    "Perfecto, voy a registrar la diferencia de caja.",
    `Esperado: ${expected}.`,
    `Contado: ${counted}.`,
    `Diferencia (${label}): ${Math.abs(difference)}.`,
    `Cuenta caja: ${account}.`,
    `Cuenta ajuste: ${adjustment}.`,
    "¿Todo correcto?"
  ].join("\n");
};

const formatCashVarianceResult = ({ expected, counted, difference }) => {
  const account = "1100 - Caja General";
  const adjustment = "3999 - Ajustes por Diferencias";
  const label = difference > 0 ? "Sobrante" : "Faltante";
  return [
    `${label} de caja registrado.`,
    `Esperado: ${expected}.`,
    `Contado: ${counted}.`,
    `Diferencia: ${Math.abs(difference)}.`,
    `Cuenta caja: ${account}.`,
    `Cuenta ajuste: ${adjustment}.`
  ].join("\n");
};
/**
 * Sistema de Acciones de RAULI Assistant
 * 
 * Ejecuta acciones en el ERP basadas en comandos de IA
 */

/**
 * Ejecuta una acción específica
 * @param {Object} action - Acción a ejecutar { type, target, params }
 * @param {Function} navigate - Función de navegación de React Router
 */
export async function executeAction(action, navigate) {
  console.log("RAULI: Ejecutando acción", action);

  switch (action.type) {
    case 'navigate':
      return executeNavigation(action.target, navigate);
    
    case 'query':
      return executeQuery(action.target, action.params);
    
    case 'create':
      return executeCreate(action.target, action.params);
    
    case 'update':
      return executeUpdate(action.target, action.params);
    
    case 'delete':
      return executeDelete(action.target, action.params);
    
    case 'analyze':
      return executeAnalysis(action.target, action.params);
    
    default:
      console.warn("Acción no reconocida:", action.type);
      return { success: false, message: "Acción no reconocida." };
  }
}

/**
 * Ejecuta navegación a un módulo
 */
function executeNavigation(target, navigate) {
  if (!target) return { success: false, message: "Ruta no encontrada" };

  const normalized = String(target).trim();
  if (normalized.startsWith("/")) {
    navigate(normalized);
    return { success: true, route: normalized, message: `Navegando a ${normalized}.` };
  }

  const routes = {
    dashboard: "/dashboard",
    inicio: "/dashboard",
    panel: "/dashboard",
    pos: "/pos",
    caja: "/pos",
    ventas: "/sales",
    venta: "/sales",
    clientes: "/customers",
    creditos: "/credits",
    productos: "/products",
    inventario: "/inventory",
    stock: "/inventory",
    calidad: "/quality",
    gastos: "/expenses",
    empleados: "/employees",
    contabilidad: "/accounting",
    "contabilidad-pro": "/accounting-advanced",
    analitica: "/analytics-advanced",
    "caja-diaria": "/cash",
    merma: "/shrinkage",
    reportes: "/reports",
    configuracion: "/settings",
    ajustes: "/settings",
    soporte: "/support",
    produccion: "/produccion",
    "config-productos": "/config-productos"
  };

  const route = routes[normalized.toLowerCase()];
  
  if (route) {
    navigate(route);
    return { success: true, route, message: `Navegando a ${route}.` };
  }

  return { success: false, message: "Ruta no encontrada." };
}

/**
 * Ejecuta consulta de datos
 */
async function executeQuery(target, params = {}) {
  const normalized = String(target || "").toLowerCase();

  if (normalized === "sales_today" || normalized === "ventas_hoy") {
    const api = await apiFetch("/sales/today");
    if (api.ok) {
      const total = api.data?.summary?.total_amount || 0;
      const count = api.data?.summary?.total_sales || 0;
      const top = api.data?.topProducts || [];
      return {
        success: true,
        message: `Ventas de hoy: ${count} ventas por ${total}. Top: ${summarizeList(top, 3, "product_name")}.`
      };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para consultar ventas del día." };
    }
    if (isOffline(api) && db?.sales) {
      const today = new Date().toISOString().split("T")[0];
      const sales = await db.sales?.filter((s) => String(s.created_at || "").startsWith(today)).toArray();
      const saleIds = sales?.map((s) => s.id) || [];
      let total = 0;
      if (saleIds.length && db.saleItems) {
        const items = await db.saleItems.where("sale_id").anyOf(saleIds).toArray();
        total = items.reduce((sum, item) => sum + Number(item.unit_price || 0) * Number(item.quantity || 0), 0);
        total = Math.round((total + Number.EPSILON) * 100) / 100;
      }
      return {
        success: true,
        message: `Ventas de hoy (offline): ${sales?.length || 0} ventas por ${total}.`
      };
    }
  }

  if (normalized === "low_stock" || normalized === "stock_bajo") {
    const api = await apiFetch("/products/low-stock");
    if (api.ok) {
      const products = api.data?.products || [];
      return {
        success: true,
        message: `Stock bajo: ${products.length} productos. ${summarizeList(products, 5, "name")}.`
      };
    }
    if (isOffline(api) && db?.products) {
      const products = await db.products.where("active").equals(1).toArray();
      const low = products.filter((p) => (p.stock ?? 0) <= (p.min_stock ?? 0));
      return {
        success: true,
        message: `Stock bajo (offline): ${low.length} productos. ${summarizeList(low, 5, "name")}.`
      };
    }
  }

  if (normalized === "products" || normalized === "product_search" || normalized === "productos") {
    const search = params?.query || "";
    const api = await apiFetch(`/products?search=${encodeURIComponent(search)}`);
    if (api.ok) {
      const products = api.data?.products || [];
      return {
        success: true,
        message: `Productos encontrados: ${products.length}. ${summarizeList(products, 5, "name")}.`
      };
    }
    if (isOffline(api) && db?.products) {
      const products = await db.products.where("active").equals(1).toArray();
      const filtered = products.filter((p) => String(p.name || "").toLowerCase().includes(String(search).toLowerCase()));
      return {
        success: true,
        message: `Productos encontrados (offline): ${filtered.length}. ${summarizeList(filtered, 5, "name")}.`
      };
    }
  }

  if (normalized === "inventory" || normalized === "inventario") {
    const api = await apiFetch("/inventory/lots?status=active");
    if (api.ok) {
      const lots = api.data?.lots || [];
      return {
        success: true,
        message: `Inventario activo: ${lots.length} lotes. ${summarizeList(lots, 5, "product_name")}.`
      };
    }
    if (isOffline(api) && db?.products) {
      const products = await db.products.where("active").equals(1).toArray();
      return {
        success: true,
        message: `Inventario local (offline): ${products.length} productos activos.`
      };
    }
  }

  if (db?.products) {
    const products = await db.products.where("active").equals(1).toArray();
    return {
      success: true,
      message: `Datos locales listos. Productos activos: ${products.length}.`
    };
  }

  return { success: false, message: "No pude completar la consulta." };
}

/**
 * Ejecuta creación de registro
 */
async function executeCreate(target, params = {}) {
  const normalized = String(target || "").toLowerCase();

  if (normalized === "product" || normalized === "producto") {
    if (!confirm(`Crear producto "${params.name || ""}" con precio ${params.price || 0}?`)) {
      return { success: false, message: "Acción cancelada." };
    }
    const body = {
      name: params.name,
      price: params.price,
      cost: params.cost,
      stock: params.stock,
      min_stock: params.min_stock,
      unit: params.unit || "unidad"
    };
    const api = await apiFetch("/products", {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (api.ok) {
      return { success: true, message: `Producto creado: ${api.data?.product?.name || body.name}.` };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para crear productos." };
    }
    if (isOffline(api) && db?.products) {
      const localId = `prod_${Date.now()}`;
      await db.products.add({
        id: localId,
        ...body,
        active: 1,
        deleted_at: null,
        synced: 0
      });
      await queueOfflineOperation("products", "create", { local_id: localId, ...body });
      return { success: true, message: "Producto guardado en modo offline. Se sincronizará al volver la conexión." };
    }
  }

  if (normalized === "sale" || normalized === "venta") {
    const items = Array.isArray(params.items) ? params.items : [];
    if (!items.length) return { success: false, message: "Faltan items para la venta." };

    const productMap = new Map();
    const productList = await db.products?.where("active").equals(1).toArray();
    productList?.forEach((p) => productMap.set(p.name.toLowerCase(), p));

    const saleItems = [];
    for (const item of items) {
      const name = String(item.product_name || item.name || "").toLowerCase();
      let match = productMap.get(name);
      if (!match && name) {
        const apiList = await apiFetch(`/products?search=${encodeURIComponent(name)}`);
        match = apiList.data?.products?.[0];
      }
      if (match?.id) {
        saleItems.push({
          product_id: match.id,
          quantity: item.quantity || 1,
          product_name: item.product_name || item.name || match.name,
          unit_price: match.price
        });
      }
    }

    if (!saleItems.length) {
      return { success: false, message: "No encontré productos válidos para la venta." };
    }

    const totalItems = saleItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
    const summary = buildSaleSummary(saleItems);
    const confirmText = `${summary.lines.slice(0, 5).join("\n")}` +
      `${summary.lines.length > 5 ? "\n..." : ""}` +
      `\nTotal estimado: ${summary.total}\n` +
      formatSaleConfirmation(saleItems, summary.total);
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }

    const api = await apiFetch("/sales", {
      method: "POST",
      body: JSON.stringify({
        items: saleItems,
        payment_method: params.payment_method || "efectivo"
      })
    });
    if (api.ok) {
      return { success: true, message: formatSaleResult(saleItems, summary.total) };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para crear ventas." };
    }
    if (isOffline(api) && db?.sales) {
      const saleId = `sale_${Date.now()}`;
      await db.sales.add({
        id: saleId,
        local_id: saleId,
        created_at: new Date().toISOString(),
        payment_status: "paid",
        status: "completed",
        synced: 0,
        voided_at: null
      });
      if (db.saleItems) {
        const items = saleItems.map((item) => ({
          id: `sale_item_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          sale_id: saleId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }));
        await db.saleItems.bulkAdd(items);
      }
      for (const item of saleItems) {
        const product = await db.products?.get(item.product_id);
        if (product) {
          await db.products.update(item.product_id, {
            stock: (Number(product.stock) || 0) - Number(item.quantity || 0),
            synced: 0
          });
        }
      }
      await queueOfflineOperation("sales", "create", {
        local_id: saleId,
        items: saleItems,
        payment_method: params.payment_method || "efectivo"
      });
      return { success: true, message: `${formatSaleResult(saleItems, summary.total)}\n\nModo offline: se sincronizará al volver la conexión.` };
    }
  }

  if (normalized === "expense" || normalized === "gasto") {
    const amount = Number(params.amount || params.total || 0);
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para el gasto." };
    }
    const description = params.description || params.detalle || "";
    const category = params.category || params.categoria || "";
    const paymentMethod = params.payment_method || params.metodo_pago || "efectivo";
    const accountCode = params.account_code || params.cuenta || "6900 - Otros Gastos";

    const confirmText = formatExpenseConfirmation({
      amount,
      description,
      category,
      paymentMethod,
      accountCode
    });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }

    const api = await apiFetch("/accounting/expenses", {
      method: "POST",
      body: JSON.stringify({
        description,
        category,
        amount,
        payment_method: paymentMethod,
        account_code: accountCode
      })
    });
    if (api.ok) {
      return { success: true, message: formatExpenseResult({ amount, description, category, paymentMethod, accountCode }) };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para registrar gastos." };
    }
    if (isOffline(api) && db?.expenses) {
      const localId = await db.expenses.add({
        date: new Date().toISOString().split("T")[0],
        vendor: params.vendor || "",
        category,
        description,
        amount,
        payment_method: paymentMethod,
        account_code: accountCode,
        deleted_at: null,
        synced: 0
      });
      await queueOfflineOperation("expenses", "create", {
        id: localId,
        date: new Date().toISOString().split("T")[0],
        vendor: params.vendor || "",
        category,
        description,
        amount,
        payment_method: paymentMethod,
        account_code: accountCode
      });
      return { success: true, message: `${formatExpenseResult({ amount, description, category, paymentMethod, accountCode })}\n\nModo offline: se sincronizará al volver la conexión.` };
    }
  }

  if (normalized === "purchase" || normalized === "compra") {
    const amount = Number(params.amount || params.total || 0);
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para la compra." };
    }
    const description = params.description || params.detalle || "Compra";
    const paymentMethod = params.payment_method || params.metodo_pago || "efectivo";

    const confirmText = formatPurchaseConfirmation({ amount, description, paymentMethod });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }

    const api = await apiFetch("/accounting/expenses", {
      method: "POST",
      body: JSON.stringify({
        description,
        category: "Compras",
        amount,
        payment_method: paymentMethod,
        account_code: "5100 - Costo de Ventas"
      })
    });
    if (api.ok) {
      return { success: true, message: formatPurchaseResult({ amount, description, paymentMethod }) };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para registrar compras." };
    }
    if (isOffline(api) && db?.expenses) {
      const localId = await db.expenses.add({
        date: new Date().toISOString().split("T")[0],
        vendor: params.vendor || "",
        category: "Compras",
        description,
        amount,
        payment_method: paymentMethod,
        account_code: "5100 - Costo de Ventas",
        deleted_at: null,
        synced: 0
      });
      await queueOfflineOperation("expenses", "create", {
        id: localId,
        date: new Date().toISOString().split("T")[0],
        vendor: params.vendor || "",
        category: "Compras",
        description,
        amount,
        payment_method: paymentMethod,
        account_code: "5100 - Costo de Ventas"
      });
      return { success: true, message: `${formatPurchaseResult({ amount, description, paymentMethod })}\n\nModo offline: se sincronizará al volver la conexión.` };
    }
  }

  if (normalized === "inventory_adjustment" || normalized === "ajuste_inventario") {
    const productName = params.product_name || params.name;
    const quantity = Number(params.quantity || params.qty || 0);
    const direction = params.direction === "in" ? "in" : "out";
    const reason = params.reason || params.motivo || "Ajuste manual";
    if (!productName || !quantity) {
      return { success: false, message: "Falta producto o cantidad para el ajuste." };
    }
    let productId = null;
    const list = await db.products?.where("active").equals(1).toArray();
    const localMatch = list?.find((p) => String(p.name || "").toLowerCase() === String(productName).toLowerCase());
    if (localMatch?.id) {
      productId = localMatch.id;
    } else {
      const apiList = await apiFetch(`/products?search=${encodeURIComponent(productName)}`);
      productId = apiList.data?.products?.[0]?.id || null;
    }
    if (!productId) {
      return { success: false, message: "Producto no encontrado para ajuste." };
    }
    const confirmText = formatInventoryAdjustmentConfirmation({ productName, quantity, direction, reason });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    const api = await apiFetch("/inventory/adjustment", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        quantity: direction === "in" ? quantity : -quantity,
        notes: reason
      })
    });
    if (api.ok) {
      return { success: true, message: formatInventoryAdjustmentResult({ productName, quantity, direction, reason }) };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para ajustar inventario." };
    }
    if (isOffline(api) && db?.products) {
      const product = list?.find((p) => p.id === productId);
      if (product) {
        const delta = direction === "in" ? quantity : -quantity;
        await db.products.update(product.id, { stock: (Number(product.stock) || 0) + delta, synced: 0 });
        await db.inventoryMovements?.add({
          product_id: product.id,
          movement_type: direction === "in" ? "in" : "out",
          quantity,
          date: new Date().toISOString(),
          reference_id: "offline_adjustment"
        });
      }
      await queueOfflineOperation("inventory_adjustments", "create", {
        product_id: productId,
        quantity: direction === "in" ? quantity : -quantity,
        notes: reason
      });
      return { success: true, message: `${formatInventoryAdjustmentResult({ productName, quantity, direction, reason })}\n\nModo offline: se sincronizará al volver la conexión.` };
    }
  }

  if (normalized === "cash_in" || normalized === "entrada_efectivo") {
    const amount = Number(params.amount || params.total || 0);
    const description = params.description || params.detalle || "Entrada de efectivo";
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para entrada de efectivo." };
    }
    const confirmText = formatCashMovementConfirmation({ amount, description, direction: "in" });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      await cashSession.cashIn(amount, description);
      return { success: true, message: formatCashMovementResult({ amount, description, direction: "in" }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando entrada de efectivo." };
    }
  }

  if (normalized === "cash_out" || normalized === "salida_efectivo") {
    const amount = Number(params.amount || params.total || 0);
    const description = params.description || params.detalle || "Salida de efectivo";
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para salida de efectivo." };
    }
    const confirmText = formatCashMovementConfirmation({ amount, description, direction: "out" });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      await cashSession.cashOut(amount, description);
      return { success: true, message: formatCashMovementResult({ amount, description, direction: "out" }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando salida de efectivo." };
    }
  }

  if (normalized === "cash_open" || normalized === "abrir_caja") {
    const amount = Number(params.amount || params.monto || 0);
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para apertura de caja." };
    }
    const confirmText = formatCashSessionConfirmation({ amount, direction: "open" });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      const api = await apiFetch("/sales/cash-sessions/open", {
        method: "POST",
        body: JSON.stringify({ opening_amount: amount })
      });
      if (api.ok) {
        return { success: true, message: formatCashSessionResult({ amount, direction: "open" }) };
      }
      if (requiresAuth(api.status)) {
        return { success: false, message: "Necesito iniciar sesión para abrir caja." };
      }
    } catch (e) {
      return { success: false, message: e.message || "Error abriendo caja." };
    }
  }

  if (normalized === "cash_close" || normalized === "cerrar_caja") {
    const amount = Number(params.amount || params.monto || 0);
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para cierre de caja." };
    }
    const confirmText = formatCashSessionConfirmation({ amount, direction: "close" });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      const current = await apiFetch("/sales/cash-sessions/current");
      const sessionId = current.data?.session?.id || current.data?.id;
      if (!sessionId) {
        return { success: false, message: "No hay caja abierta para cerrar." };
      }
      const api = await apiFetch(`/sales/cash-sessions/${sessionId}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_amount: amount })
      });
      if (api.ok) {
        return { success: true, message: formatCashSessionResult({ amount, direction: "close" }) };
      }
      if (requiresAuth(api.status)) {
        return { success: false, message: "Necesito iniciar sesión para cerrar caja." };
      }
    } catch (e) {
      return { success: false, message: e.message || "Error cerrando caja." };
    }
  }

  if (normalized === "credit_payment" || normalized === "abono_credito") {
    const amount = Number(params.amount || params.monto || 0);
    const customerId = params.customer_id || params.id;
    const customerName = params.customer_name || params.nombre;
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para el abono." };
    }
    const confirmText = formatCreditPaymentConfirmation({ amount, customerName });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      let customer = null;
      if (customerId) {
        customer = await db.customers?.get(customerId);
      } else if (customerName) {
        const list = await db.customers?.where("active").equals(1).toArray();
        customer = list?.find((c) => String(c.name || "").toLowerCase() === String(customerName).toLowerCase());
      }
      if (!customer) {
        return { success: false, message: "Cliente no encontrado para el abono." };
      }
      const nextBalance = Math.max(0, (Number(customer.balance) || 0) - amount);
      await db.customers?.update(customer.id, { balance: nextBalance });
      await accountingCore.recordPaymentReceived({
        customerId: customer.id,
        amount,
        reference: `PAY-${customer.id}-${Date.now()}`
      });
      return { success: true, message: formatCreditPaymentResult({ amount, customerName: customer.name }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando abono." };
    }
  }

  if (normalized === "credit_note" || normalized === "nota_credito") {
    const amount = Number(params.amount || params.monto || 0);
    const paymentMethod = params.payment_method || params.metodo_pago || "efectivo";
    const reason = params.reason || params.motivo || "Nota de crédito";
    const customerId = params.customer_id || params.id;
    const customerName = params.customer_name || params.nombre;
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para la nota de crédito." };
    }
    const confirmText = formatCreditNoteConfirmation({ amount, customerName, paymentMethod, reason });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      await accountingCore.initialize();
      let customer = null;
      if (paymentMethod === "credito") {
        if (customerId) {
          customer = await db.customers?.get(customerId);
        } else if (customerName) {
          const list = await db.customers?.where("active").equals(1).toArray();
          customer = list?.find((c) => String(c.name || "").toLowerCase() === String(customerName).toLowerCase());
        }
        if (!customer) {
          return { success: false, message: "Cliente no encontrado para aplicar nota de crédito." };
        }
        const currentBalance = Number(customer.balance) || 0;
        if (amount > currentBalance) {
          return { success: false, message: "El monto supera el saldo pendiente del cliente." };
        }
        const nextBalance = Math.max(0, currentBalance - amount);
        await db.customers?.update(customer.id, { balance: nextBalance });
      }
      const creditAccount = paymentMethod === "credito"
        ? "1200"
        : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
          ? "1120"
          : "1100";
      await accountingCore.createJournalEntry({
        description: `Nota de crédito${customer ? ` - ${customer.name}` : ""}`,
        reference: `CN-${Date.now()}`,
        type: "credit_note",
        lines: [
          { accountCode: "4110", debit: amount, description: "Devolución sobre ventas" },
          { accountCode: creditAccount, credit: amount, description: "Aplicación nota de crédito" }
        ]
      });
      if (creditAccount === "1100") {
        await cashSession.cashOut(amount, "Devolución por nota de crédito");
      }
      return { success: true, message: formatCreditNoteResult({ amount, customerName: customer?.name || customerName, paymentMethod, reason }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando nota de crédito." };
    }
  }

  if (normalized === "refund_partial" || normalized === "devolucion_parcial") {
    const saleId = params.id || params.sale_id;
    const amount = Number(params.amount || params.monto || 0);
    const paymentMethod = params.payment_method || params.metodo_pago || "efectivo";
    const customerId = params.customer_id || params.id_cliente;
    const customerName = params.customer_name || params.nombre;
    if (!saleId) return { success: false, message: "Falta el ID de la venta para devolución parcial." };
    if (!amount || amount <= 0) {
      return { success: false, message: "Monto inválido para devolución parcial." };
    }
    const confirmText = formatPartialRefundConfirmation({ amount, saleId, paymentMethod });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      await accountingCore.initialize();
      let customer = null;
      if (paymentMethod === "credito") {
        if (customerId) {
          customer = await db.customers?.get(customerId);
        } else if (customerName) {
          const list = await db.customers?.where("active").equals(1).toArray();
          customer = list?.find((c) => String(c.name || "").toLowerCase() === String(customerName).toLowerCase());
        }
        if (!customer) {
          return { success: false, message: "Cliente no encontrado para devolución a crédito." };
        }
        const currentBalance = Number(customer.balance) || 0;
        const nextBalance = Math.max(0, currentBalance - amount);
        await db.customers?.update(customer.id, { balance: nextBalance });
      }
      const creditAccount = paymentMethod === "credito"
        ? "1200"
        : paymentMethod === "tarjeta" || paymentMethod === "transferencia"
          ? "1120"
          : "1100";
      await accountingCore.createJournalEntry({
        description: `Devolución parcial venta ${saleId}`,
        reference: `REF-${saleId}-${Date.now()}`,
        type: "refund_partial",
        lines: [
          { accountCode: "4110", debit: amount, description: "Devolución sobre ventas" },
          { accountCode: creditAccount, credit: amount, description: "Aplicación devolución parcial" }
        ]
      });
      if (creditAccount === "1100") {
        await cashSession.cashOut(amount, `Devolución parcial venta ${saleId}`);
      }
      return { success: true, message: formatPartialRefundResult({ amount, saleId, paymentMethod }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando devolución parcial." };
    }
  }

  if (normalized === "cash_variance" || normalized === "cierre_caja_diferencia") {
    const expected = Number(params.expected ?? params.esperado ?? 0);
    const counted = Number(params.counted ?? params.contado ?? 0);
    if (!Number.isFinite(expected) || expected < 0 || !Number.isFinite(counted) || counted < 0) {
      return { success: false, message: "Montos inválidos para diferencia de caja." };
    }
    const difference = Math.round((counted - expected + Number.EPSILON) * 100) / 100;
    if (difference === 0) {
      return { success: true, message: "No hay diferencia de caja." };
    }
    const confirmText = formatCashVarianceConfirmation({ expected, counted, difference });
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    try {
      await accountingCore.initialize();
      const lines = difference > 0
        ? [
            { accountCode: "1100", debit: Math.abs(difference), description: "Sobrante de caja" },
            { accountCode: "3999", credit: Math.abs(difference), description: "Ajuste por diferencia" }
          ]
        : [
            { accountCode: "3999", debit: Math.abs(difference), description: "Ajuste por diferencia" },
            { accountCode: "1100", credit: Math.abs(difference), description: "Faltante de caja" }
          ];
      await accountingCore.createJournalEntry({
        description: "Diferencia de caja",
        reference: `CASH-DIFF-${Date.now()}`,
        type: "cash_variance",
        lines
      });
      return { success: true, message: formatCashVarianceResult({ expected, counted, difference }) };
    } catch (e) {
      return { success: false, message: e.message || "Error registrando diferencia de caja." };
    }
  }

  return { success: false, message: "No pude crear el registro." };
}

/**
 * Ejecuta actualización de registro
 */
async function executeUpdate(target, params = {}) {
  const normalized = String(target || "").toLowerCase();

  if (normalized === "stock" || normalized === "inventory") {
    const productName = params.product_name || params.name;
    if (!productName) return { success: false, message: "Indica el producto a actualizar." };

    const apiList = await apiFetch(`/products?search=${encodeURIComponent(productName)}`);
    const product = apiList.data?.products?.[0];
    const resolvedProduct = product || await findLocalProductByName(productName);
    if (!resolvedProduct) {
      return { success: false, message: "Producto no encontrado." };
    }

    const confirmText = [
      `Actualizar stock de "${resolvedProduct.name}" a ${params.stock}.`,
      "Esto afectará inventario (1300) y resultados si hay disminución.",
      "¿Confirmas?"
    ].join("\n");
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }

    const api = await apiFetch(`/products/${resolvedProduct.id}`, {
      method: "PUT",
      body: JSON.stringify({ stock: params.stock })
    });
    if (api.ok) {
      return { success: true, message: `Stock actualizado para ${resolvedProduct.name}. Inventario (1300) ajustado.` };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para actualizar stock." };
    }
    if (isOffline(api) && db?.products) {
      await db.products.update(resolvedProduct.id, { stock: params.stock, synced: 0 });
      await queueOfflineOperation("products", "update", { id: resolvedProduct.id, stock: params.stock });
      return { success: true, message: `Stock actualizado offline para ${resolvedProduct.name}. Inventario (1300) se sincronizará luego.` };
    }
  }

  if (normalized === "cancel_sale" || normalized === "anular_venta") {
    const saleId = params.id || params.sale_id;
    if (!saleId) return { success: false, message: "Falta el ID de la venta a anular." };
    const confirmText = [
      `Vas a anular la venta ${saleId}.`,
      "Esto revertirá el ingreso y el movimiento de caja/banco correspondiente.",
      "¿Confirmas?"
    ].join("\n");
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    const api = await apiFetch(`/sales/${saleId}/cancel`, { method: "POST", body: JSON.stringify({ reason: params.reason || "Anulación manual" }) });
    if (api.ok) {
      return { success: true, message: "Venta anulada. Se revirtió el ingreso y la cuenta de caja/banco." };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para anular ventas." };
    }
  }

  if (normalized === "refund" || normalized === "devolucion") {
    const saleId = params.id || params.sale_id;
    if (!saleId) return { success: false, message: "Falta el ID de la venta para devolución." };
    const confirmText = [
      `Vas a registrar una devolución para la venta ${saleId}.`,
      "Esto revertirá el ingreso y el movimiento de caja/banco correspondiente.",
      "¿Confirmas?"
    ].join("\n");
    if (!confirm(confirmText)) {
      return { success: false, message: "Acción cancelada." };
    }
    const api = await apiFetch(`/sales/${saleId}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason: params.reason || "Devolución" })
    });
    if (api.ok) {
      return { success: true, message: "Devolución registrada. Se revirtió el ingreso y la cuenta de caja/banco." };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para registrar devoluciones." };
    }
  }

  return { success: false, message: "No pude actualizar el registro." };
}

/**
 * Ejecuta eliminación de registro
 */
async function executeDelete(target, params = {}) {
  const normalized = String(target || "").toLowerCase();
  if (normalized === "product" || normalized === "producto") {
    const productId = params.id;
    if (!productId) return { success: false, message: "Falta el ID del producto." };
    if (!confirm("Desactivar este producto?")) {
      return { success: false, message: "Acción cancelada." };
    }
    const api = await apiFetch(`/products/${productId}`, { method: "DELETE" });
    if (api.ok) {
      return { success: true, message: "Producto desactivado." };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para eliminar productos." };
    }
    if (isOffline(api) && db?.products) {
      await db.products.update(productId, { active: 0, deleted_at: new Date().toISOString(), synced: 0 });
      await queueOfflineOperation("products", "delete", { id: productId });
      return { success: true, message: "Producto desactivado offline. Se sincronizará al volver la conexión." };
    }
  }
  return { success: false, message: "No pude eliminar el registro." };
}

/**
 * Ejecuta análisis de datos
 */
async function executeAnalysis(target, params = {}) {
  const normalized = String(target || "").toLowerCase();
  if (normalized === "summary" || normalized === "resumen") {
    const products = await db.products?.where("active").equals(1).toArray();
    const today = new Date().toISOString().split("T")[0];
    const sales = await db.sales?.filter((s) => String(s.created_at || "").startsWith(today)).toArray();
    return {
      success: true,
      message: `Resumen: ${products?.length || 0} productos activos, ${sales?.length || 0} ventas hoy.`
    };
  }
  return { success: true, message: "Análisis completado." };
}
