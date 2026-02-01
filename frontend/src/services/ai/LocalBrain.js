import { useCallback } from "react";
import { db } from "../dataService";
import { formatCurrency } from "../../config/businessConfig";

const NAVIGATION_MAP = [
  { keywords: ["dashboard", "inicio", "panel"], path: "/dashboard", label: "Dashboard" },
  { keywords: ["ventas", "pos", "punto de venta", "vender", "caja"], path: "/pos", label: "Punto de venta" },
  { keywords: ["clientes", "customer"], path: "/customers", label: "Clientes" },
  { keywords: ["inventario", "stock"], path: "/inventory", label: "Inventario" },
  { keywords: ["productos", "catalogo", "catálogo"], path: "/products", label: "Productos" },
  { keywords: ["empleados", "rrhh", "personal", "trabajadores"], path: "/employees", label: "RRHH" },
  { keywords: ["contabilidad", "cuentas", "finanzas"], path: "/accounting", label: "Contabilidad" },
  { keywords: ["reportes", "informes", "estadisticas", "estadísticas"], path: "/reports", label: "Reportes" },
  { keywords: ["configuracion", "configuración", "ajustes", "opciones"], path: "/settings", label: "Configuración" }
];

const matchAny = (text, list) => list.some((k) => text.includes(k));

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
};

const sumSaleTotal = (sale) => (
  sale?.total ??
  sale?.total_amount ??
  sale?.grand_total ??
  0
);

export const useLocalBrain = () => {
  const process = useCallback(async (rawText) => {
    const text = String(rawText || "").toLowerCase().trim();
    if (!text) return { handled: false };

    const isHelp = matchAny(text, ["ayuda", "help", "no se como", "no sé como", "no sé", "tutorial", "tour"]);
    if (isHelp) {
      return {
        handled: true,
        response: "Claro. Abriendo el tour de bienvenida para guiarte paso a paso.",
        action: { action: "OPEN_TOUR" }
      };
    }

    const navTarget = NAVIGATION_MAP.find((item) => matchAny(text, item.keywords));
    if (navTarget && matchAny(text, ["ir a", "abrir", "abre", "muestra", "llévame", "llevame", "quiero", "ver", "vender"])) {
      return {
        handled: true,
        response: `¡Entendido! Abriendo ${navTarget.label}.`,
        action: { action: "NAVIGATE", to: navTarget.path }
      };
    }

    if (matchAny(text, ["nuevo cliente", "registrar cliente", "crear cliente"])) {
      return {
        handled: true,
        response: "¡Perfecto! Abriendo clientes y preparando el formulario.",
        action: { action: "NAVIGATE_AND_OPEN", to: "/customers", modal: "OPEN_CUSTOMER_MODAL" }
      };
    }

    if (matchAny(text, ["nuevo producto", "meter producto", "registrar producto", "agregar producto"])) {
      return {
        handled: true,
        response: "Listo. Abriendo productos y mostrando el alta automática.",
        action: { action: "NAVIGATE_AND_OPEN", to: "/products", modal: "OPEN_PRODUCT_MODAL" }
      };
    }

    if (matchAny(text, ["nueva factura", "crear factura", "hacer venta", "vender"])) {
      return {
        handled: true,
        response: "¡Entendido! Abriendo el POS y dejando listo el buscador. 💸",
        action: { action: "NAVIGATE_AND_OPEN", to: "/pos", modal: "FOCUS_POS_SEARCH" }
      };
    }

    if (matchAny(text, ["ajuste de stock", "ajustar inventario", "ajuste inventario", "corregir stock", "ajuste de inventario"])) {
      return {
        handled: true,
        response: "Abriendo inventario para ajustar stock.",
        action: { action: "NAVIGATE_AND_OPEN", to: "/inventory", modal: "OPEN_INVENTORY_ADJUSTMENT_MODAL" }
      };
    }

    if (matchAny(text, ["nuevo lote", "entrada de inventario", "registrar lote"])) {
      return {
        handled: true,
        response: "Perfecto. Abriendo inventario para crear un nuevo lote.",
        action: { action: "NAVIGATE_AND_OPEN", to: "/inventory", modal: "OPEN_INVENTORY_LOT_MODAL" }
      };
    }

    if (matchAny(text, ["orden de produccion", "orden de producción", "producir", "nueva produccion", "nueva producción"])) {
      return {
        handled: true,
        response: "Listo. Abriendo inventario para crear una orden de producción.",
        action: { action: "NAVIGATE_AND_OPEN", to: "/inventory", modal: "OPEN_INVENTORY_PRODUCTION_MODAL" }
      };
    }

    if (matchAny(text, ["cuanto vendi hoy", "cuánto vendí hoy", "ventas de hoy", "total de ventas", "vendimos hoy"])) {
      const { start, end } = getTodayRange();
      const sales = await db.sales?.where("created_at").between(start, end).toArray();
      const total = (sales || []).reduce((sum, sale) => sum + sumSaleTotal(sale), 0);
      return {
        handled: true,
        response: `Ventas de hoy: ${formatCurrency(total)}.`
      };
    }

    if (matchAny(text, ["stock bajo", "se esta acabando", "se está acabando", "productos bajos", "poco stock"])) {
      const products = await db.products?.where("active").equals(1).toArray();
      const low = (products || []).filter((p) => (p.stock || 0) < 5);
      const names = low.slice(0, 3).map((p) => p.name).filter(Boolean);
      const tail = low.length > 3 ? `, y ${low.length - 3} más.` : ".";
      const list = names.length ? `Ejemplos: ${names.join(", ")}${tail}` : "";
      return {
        handled: true,
        response: `Productos con stock bajo: ${low.length}. ${list}`.trim()
      };
    }

    return { handled: false };
  }, []);

  return { process };
};
