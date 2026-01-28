import { db } from "../../services/dataService";
import SyncService from "../../services/syncService";

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
    const confirmText = `Crear venta con ${totalItems} items?\n` +
      `${summary.lines.slice(0, 5).join("\n")}` +
      `${summary.lines.length > 5 ? "\n..." : ""}` +
      `\nTotal estimado: ${summary.total}`;
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
      return { success: true, message: "Venta creada correctamente." };
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
      return { success: true, message: "Venta guardada en modo offline. Se sincronizará al volver la conexión." };
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

    if (!confirm(`Actualizar stock de "${resolvedProduct.name}" a ${params.stock}?`)) {
      return { success: false, message: "Acción cancelada." };
    }

    const api = await apiFetch(`/products/${resolvedProduct.id}`, {
      method: "PUT",
      body: JSON.stringify({ stock: params.stock })
    });
    if (api.ok) {
      return { success: true, message: `Stock actualizado para ${resolvedProduct.name}.` };
    }
    if (requiresAuth(api.status)) {
      return { success: false, message: "Necesito iniciar sesión para actualizar stock." };
    }
    if (isOffline(api) && db?.products) {
      await db.products.update(resolvedProduct.id, { stock: params.stock, synced: 0 });
      await queueOfflineOperation("products", "update", { id: resolvedProduct.id, stock: params.stock });
      return { success: true, message: `Stock actualizado offline para ${resolvedProduct.name}. Se sincronizará luego.` };
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
