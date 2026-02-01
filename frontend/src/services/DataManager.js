import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { db } from "./dataService";
import { formatCurrency } from "../config/businessConfig";
import { APP_VERSION } from "../config/version";

const BRAND_NAME = "GENESIS";

const DEFAULT_ACCOUNTS = [
  { id: "acc_1100", code: "1100", name: "Caja", type: "asset", parent: null },
  { id: "acc_1200", code: "1200", name: "Banco", type: "asset", parent: null },
  { id: "acc_1300", code: "1300", name: "Cuentas por cobrar", type: "asset", parent: null },
  { id: "acc_1400", code: "1400", name: "Inventario", type: "asset", parent: null },
  { id: "acc_2100", code: "2100", name: "Cuentas por pagar", type: "liability", parent: null },
  { id: "acc_3100", code: "3100", name: "Capital", type: "equity", parent: null },
  { id: "acc_4100", code: "4100", name: "Ventas", type: "income", parent: null },
  { id: "acc_5100", code: "5100", name: "Costo de ventas", type: "expense", parent: null },
  { id: "acc_5200", code: "5200", name: "Gastos operativos", type: "expense", parent: null }
];

const normalizeKey = (value) => String(value || "").trim().toLowerCase();

const normalizeRow = (row = {}) => {
  const normalized = {};
  Object.entries(row).forEach(([key, value]) => {
    normalized[normalizeKey(key)] = value;
  });
  return normalized;
};

const pickValue = (row, keys) => {
  const normalized = normalizeRow(row);
  for (const key of keys) {
    const value = normalized[normalizeKey(key)];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (value === undefined || value === null) return 0;
  const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const blobToDataUrl = (blob) => new Promise((resolve) => {
  const reader = new FileReader();
  reader.onloadend = () => resolve(reader.result);
  reader.readAsDataURL(blob);
});

const fetchLogoDataUrl = async () => {
  try {
    const response = await fetch("/logo-genesis.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
};

const getTablesData = async () => {
  const data = {};
  for (const table of db.tables) {
    data[table.name] = await table.toArray();
  }
  return data;
};

const ensureCategory = async (name, cache) => {
  const normalized = String(name || "").trim();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized);
  const existing = await db.categories?.where("name").equals(normalized).first();
  if (existing?.id) {
    cache.set(normalized, existing.id);
    return existing.id;
  }
  const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  await db.categories?.add({ id, name: normalized, active: 1, deleted_at: null });
  cache.set(normalized, id);
  return id;
};

const importCustomers = async (rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const rawRow of rows) {
    const name = pickValue(rawRow, ["name", "nombre", "cliente", "razon social", "razón social", "company"]);
    if (!name) {
      skipped += 1;
      continue;
    }
    const phone = pickValue(rawRow, ["phone", "telefono", "teléfono", "celular", "movil", "móvil"]);
    const email = pickValue(rawRow, ["email", "correo", "mail"]);
    const balance = parseNumber(pickValue(rawRow, ["balance", "saldo", "deuda"]));
    await db.customers?.add({
      name: String(name).trim(),
      phone: String(phone || "").trim(),
      email: String(email || "").trim(),
      balance,
      active: 1,
      deleted_at: null
    });
    inserted += 1;
  }
  return { inserted, skipped };
};

const importInventory = async (rows) => {
  let inserted = 0;
  let skipped = 0;
  const categoryCache = new Map();
  for (const rawRow of rows) {
    const name = pickValue(rawRow, ["name", "nombre", "producto", "item"]);
    if (!name) {
      skipped += 1;
      continue;
    }
    const barcode = pickValue(rawRow, ["barcode", "codigo", "código", "sku"]);
    const price = parseNumber(pickValue(rawRow, ["price", "precio", "venta"]));
    const cost = parseNumber(pickValue(rawRow, ["cost", "costo", "compra"]));
    const stock = parseNumber(pickValue(rawRow, ["stock", "existencia", "cantidad", "qty", "quantity"]));
    const uom = pickValue(rawRow, ["uom", "unidad", "unidad de medida", "unit"]);
    const categoryName = pickValue(rawRow, ["category", "categoria", "categoría"]);
    const categoryId = categoryName ? await ensureCategory(categoryName, categoryCache) : null;

    const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.products?.add({
      id,
      name: String(name).trim(),
      barcode: String(barcode || "").trim(),
      category_id: categoryId || null,
      price,
      cost,
      stock,
      uom: String(uom || "").trim(),
      active: 1,
      deleted_at: null,
      synced: 0
    });
    inserted += 1;
  }
  return { inserted, skipped };
};

const normalizeAccountType = (value) => {
  const raw = String(value || "").toLowerCase();
  if (["asset", "activo", "activos"].includes(raw)) return "asset";
  if (["liability", "pasivo", "pasivos"].includes(raw)) return "liability";
  if (["equity", "patrimonio", "capital"].includes(raw)) return "equity";
  if (["income", "ingreso", "ingresos", "venta", "ventas"].includes(raw)) return "income";
  if (["expense", "gasto", "gastos", "costo", "costos"].includes(raw)) return "expense";
  return "asset";
};

const importCategories = async (rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const rawRow of rows) {
    const name = pickValue(rawRow, ["name", "nombre", "categoria", "categoría", "category"]);
    if (!name) {
      skipped += 1;
      continue;
    }
    const normalized = String(name).trim();
    const existing = await db.categories?.where("name").equals(normalized).first();
    if (existing?.id) {
      skipped += 1;
      continue;
    }
    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.categories?.add({ id, name: normalized, active: 1, deleted_at: null });
    inserted += 1;
  }
  return { inserted, skipped };
};

const importAccounts = async (rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const rawRow of rows) {
    const code = pickValue(rawRow, ["code", "codigo", "código"]);
    const name = pickValue(rawRow, ["name", "nombre", "cuenta"]);
    if (!code || !name) {
      skipped += 1;
      continue;
    }
    const normalizedCode = String(code).trim();
    const existing = await db.accounts?.where("code").equals(normalizedCode).first();
    if (existing?.id) {
      skipped += 1;
      continue;
    }
    const type = normalizeAccountType(pickValue(rawRow, ["type", "tipo", "clasificacion", "clasificación"]));
    const parent = pickValue(rawRow, ["parent", "padre", "parent_code", "codigo_padre"]);
    const id = `acc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    await db.accounts?.add({
      id,
      code: normalizedCode,
      name: String(name).trim(),
      type,
      parent: parent ? String(parent).trim() : null,
      active: 1
    });
    inserted += 1;
  }
  return { inserted, skipped };
};

const importExpenses = async (rows) => {
  let inserted = 0;
  let skipped = 0;
  for (const rawRow of rows) {
    const vendor = pickValue(rawRow, ["vendor", "proveedor", "comercio", "empresa"]);
    const amount = parseNumber(pickValue(rawRow, ["amount", "monto", "importe", "total"]));
    if (!vendor || !amount) {
      skipped += 1;
      continue;
    }
    const category = pickValue(rawRow, ["category", "categoria", "categoría"]);
    const date = pickValue(rawRow, ["date", "fecha"]);
    await db.expenses?.add({
      date: date ? String(date).trim() : new Date().toISOString().slice(0, 10),
      category: category ? String(category).trim() : "otros",
      vendor: String(vendor).trim(),
      amount,
      status: "recorded",
      evidence_id: null,
      ai_extracted: 0,
      deleted_at: null,
      synced: 0
    });
    inserted += 1;
  }
  return { inserted, skipped };
};

const parseWorkbookRows = async (file) => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { defval: "" });
};

const buildSummaryRows = async () => {
  const [customers, products, sales, expenses, accounts] = await Promise.all([
    db.customers?.toArray() || [],
    db.products?.toArray() || [],
    db.sales?.toArray() || [],
    db.expenses?.toArray() || [],
    db.accounts?.toArray() || []
  ]);
  const salesTotal = sales.reduce((sum, s) => sum + (s.total || 0), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return [
    ["Clientes", customers.length],
    ["Productos", products.length],
    ["Cuentas contables", accounts.length],
    ["Ventas", formatCurrency(salesTotal)],
    ["Gastos", formatCurrency(expensesTotal)]
  ];
};

const DataManager = {
  async isDatabaseEmpty() {
    const [products, customers, accounts] = await Promise.all([
      db.products?.count() || 0,
      db.customers?.count() || 0,
      db.accounts?.count() || 0
    ]);
    return products === 0 && customers === 0 && accounts === 0;
  },

  async loadStandardChartOfAccounts() {
    const count = await db.accounts?.count();
    if (count && count > 0) {
      return { skipped: true };
    }
    await db.accounts?.bulkAdd(DEFAULT_ACCOUNTS.map((account) => ({ ...account, active: 1 })));
    return { inserted: DEFAULT_ACCOUNTS.length };
  },

  async importFromFile(file, { type }) {
    if (!file) throw new Error("Archivo inválido");
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "csv"].includes(extension)) {
      throw new Error("Formato no soportado. Usa .xlsx o .csv");
    }
    const rows = await parseWorkbookRows(file);
    if (!rows.length) {
      return { inserted: 0, skipped: 0, message: "No se encontraron filas" };
    }
    if (type === "customers") {
      return await importCustomers(rows);
    }
    if (type === "inventory" || type === "products") {
      return await importInventory(rows);
    }
    if (type === "categories") {
      return await importCategories(rows);
    }
    if (type === "accounts") {
      return await importAccounts(rows);
    }
    if (type === "expenses") {
      return await importExpenses(rows);
    }
    throw new Error("Tipo de importación no soportado");
  },

  async exportToJson() {
    const data = await getTablesData();
    const payload = {
      meta: {
        app: BRAND_NAME,
        version: APP_VERSION,
        exportedAt: new Date().toISOString()
      },
      data
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `genesis-backup-${new Date().toISOString().slice(0, 10)}.json`);
  },

  async exportToExcel() {
    const data = await getTablesData();
    const workbook = XLSX.utils.book_new();
    const orderedTables = [
      "accounts",
      "customers",
      "products",
      "categories",
      "sales",
      "saleItems",
      "expenses",
      "journalEntries",
      "journalLines",
      "inventoryMovements",
      "cashMovements",
      "cashSessions",
      "settings"
    ];

    orderedTables.forEach((tableName) => {
      const rows = data[tableName] || [];
      if (!rows.length) return;
      const sheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, sheet, tableName.slice(0, 31));
    });

    if (!workbook.SheetNames.length) {
      const emptySheet = XLSX.utils.aoa_to_sheet([["Sin datos disponibles"]]);
      XLSX.utils.book_append_sheet(workbook, emptySheet, "Resumen");
    }

    XLSX.writeFile(workbook, `genesis-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  },

  async exportToPdf() {
    const doc = new jsPDF();
    const logo = await fetchLogoDataUrl();
    const exportedAt = new Date().toLocaleString("es-DO");

    if (logo) {
      doc.addImage(logo, "PNG", 14, 12, 20, 20);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(BRAND_NAME, 40, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Reporte oficial • ${exportedAt}`, 40, 26);

    const summaryRows = await buildSummaryRows();
    doc.autoTable({
      startY: 40,
      head: [["Resumen", "Valor"]],
      body: summaryRows,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 95] }
    });

    doc.save(`genesis-reporte-${new Date().toISOString().slice(0, 10)}.pdf`);
  }
};

export default DataManager;
