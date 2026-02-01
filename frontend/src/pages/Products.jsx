import { useMemo, useRef, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HiOutlinePencil, HiOutlineTrash } from "react-icons/hi";
import { db, logAudit } from "../services/dataService";
import { useAuth } from "../context/AuthContext";
import { useCommandCenter } from "../context/CommandCenterContext";
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";

export default function Products() {
  const readWithMigration = (key, legacyKey) => {
    try {
      const current = localStorage.getItem(key);
      if (current !== null) return current;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        return legacy;
      }
    } catch {}
    return null;
  };
  const { user } = useAuth();
  const { on } = useCommandCenter();
  const [products, setProducts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const defaultForm = { name: "", price: "", cost: "", stock: "" };
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const draftKey = "genesis_product_draft";
  const legacyDraftKey = "rauli_product_draft";
  const [selectedIds, setSelectedIds] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);
  const rowHeight = 52;
  const canDelete = ["admin", "gerente"].includes(user?.role);

  useEffect(() => { loadProducts(); }, []);


  const loadProducts = async () => {
    try {
      const data = await db.products?.where("active").equals(1).toArray() || [];
      setProducts(data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Nombre requerido";
    if (!form.price) nextErrors.price = "Precio requerido";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    try {
      setIsSaving(true);
      if (editingProduct) {
        await db.products.update(editingProduct.id, {
          name: form.name,
          price: parseFloat(form.price) || 0,
          cost: parseFloat(form.cost) || 0,
          stock: parseInt(form.stock) || 0
        });
        try {
          await logAudit("product", editingProduct.id, "update", user?.id, {
            before: editingProduct,
            after: {
              name: form.name,
              price: parseFloat(form.price) || 0,
              cost: parseFloat(form.cost) || 0,
              stock: parseInt(form.stock) || 0
            }
          });
        } catch {}
      } else {
        const newProduct = {
          id: `prod_${Date.now()}`,
          name: form.name,
          price: parseFloat(form.price) || 0,
          cost: parseFloat(form.cost) || 0,
          stock: parseInt(form.stock) || 0,
          active: 1,
          deleted_at: null,
          created_at: new Date().toISOString()
        };
        await db.products.add(newProduct);
        try { await logAudit("product", newProduct.id, "create", user?.id, newProduct); } catch {}
      }
      setForm(defaultForm);
      setEditingProduct(null);
      setErrors({});
      try { localStorage.removeItem(draftKey); } catch {}
      setShowModal(false);
      loadProducts();
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name || "",
      price: product.price ?? "",
      cost: product.cost ?? "",
      stock: product.stock ?? ""
    });
    setShowModal(true);
  };

  const handleDelete = async (product) => {
    if (!confirm("¿Seguro?")) return;
    try {
      await db.products.update(product.id, { active: 0, deleted_at: new Date().toISOString() });
      try { await logAudit("product", product.id, "delete", user?.id, { before: product }); } catch {}
      loadProducts();
    } catch (e) { console.error(e); }
  };

  const handleBulkDelete = async () => {
    if (!canDelete) return;
    if (selectedIds.length === 0) return;
    if (!confirm("¿Seguro? Se eliminarán los productos seleccionados.")) return;
    try {
      await Promise.all(
        selectedIds.map(id => db.products.update(id, { active: 0, deleted_at: new Date().toISOString() }))
      );
      try { await logAudit("product", "bulk", "delete", user?.id, { ids: selectedIds }); } catch {}
      setSelectedIds([]);
      loadProducts();
    } catch (e) { console.error(e); }
  };

  const exportProductsCSV = (rows) => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Nombre", "Precio", "Costo", "Stock"];
    const lines = [
      header.join(","),
      ...rows.map(p => [
        escape(p.name),
        escape(p.price ?? 0),
        escape(p.cost ?? 0),
        escape(p.stock ?? 0)
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "productos.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setForm(defaultForm);
    setEditingProduct(null);
    setErrors({});
    try {
      localStorage.removeItem(draftKey);
      localStorage.removeItem(legacyDraftKey);
    } catch {}
  };

  const handleClose = () => {
    setShowModal(false);
    handleReset();
  };

  useEffect(() => {
    const unsubscribe = on("OPEN_PRODUCT_MODAL", () => {
      handleReset();
      setShowModal(true);
    });
    return () => unsubscribe();
  }, [on, handleReset]);

  useEffect(() => {
    if (!showModal || editingProduct) return;
    try {
      const saved = readWithMigration(draftKey, legacyDraftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm({ ...defaultForm, ...parsed });
      }
    } catch {}
  }, [showModal, editingProduct]);

  useEffect(() => {
    if (!showModal || editingProduct) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {}
  }, [form, showModal, editingProduct]);

  useEffect(() => {
    if (!showModal) return;
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        handleClose();
      }
      if (event.key === "Enter" && !event.shiftKey) {
        const tag = event.target?.tagName?.toLowerCase();
        if (tag !== "textarea") {
          event.preventDefault();
          if (!isSaving) handleSave();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showModal, isSaving, handleSave]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => (p.name || "").toLowerCase().includes(term));
  }, [products, search]);

  const filteredIds = useMemo(() => filteredProducts.map(p => p.id), [filteredProducts]);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredIds]);
      setSelectedIds(Array.from(merged));
    }
  };

  const totalRows = filteredProducts.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - 2);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + 4;
  const endIndex = Math.min(totalRows, startIndex + visibleCount);
  const visibleProducts = filteredProducts.slice(startIndex, endIndex);
  const topSpacerHeight = startIndex * rowHeight;
  const bottomSpacerHeight = (totalRows - endIndex) * rowHeight;

  const auditHistory = useLiveQuery(async () => {
    const rows = await db.auditLog?.where("entity_type").equals("product").toArray() || [];
    return rows
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 50);
  }, []) || [];

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => setScrollTop(el.scrollTop);
    const handleResize = () => setViewportHeight(el.clientHeight || 520);
    handleResize();
    el.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.products", "Productos")}</h1>
          <p className="text-sm text-slate-400">{products.length} productos registrados</p>
        </div>
        <div className="flex flex-1 min-w-[240px] max-w-2xl items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
            >
              Limpiar
            </button>
          )}
        </div>
        <button onClick={() => { handleReset(); setShowModal(true); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg">+ Nuevo Producto</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
        <span className="text-sm text-slate-400">{selectedIds.length} seleccionados</span>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Ver historial
          </button>
          <button
            onClick={() => exportProductsCSV(selectedIds.length ? products.filter(p => selectedIds.includes(p.id)) : filteredProducts)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Exportar CSV
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={!canDelete || selectedIds.length === 0}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Borrar seleccionados
          </button>
        </div>
      </div>
      <div
        ref={listRef}
        className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden min-h-[520px] max-h-[calc(100vh-18rem)] overflow-y-auto"
      >
        <table className="w-full">
          <thead className="bg-slate-900">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400">Producto</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Precio</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Costo</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-400">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {products.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">No hay productos registrados</td></tr>
            ) : filteredProducts.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-500">Sin resultados para "{search}"</td></tr>
            ) : (
              <>
                {topSpacerHeight > 0 && (
                  <tr>
                    <td colSpan="6" style={{ height: topSpacerHeight }} />
                  </tr>
                )}
                {visibleProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => setSelectedIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                  />
                </td>
                <td className="px-4 py-3 text-sm text-white font-medium">{p.name}</td>
                <td className="px-4 py-3 text-sm text-right text-emerald-400">{formatCurrency(p.price)}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-400">{formatCurrency(p.cost)}</td>
                <td className="px-4 py-3 text-sm text-right"><span className={`${(p.stock || 0) < 5 ? "text-red-400" : "text-white"}`}>{p.stock || 0}</span></td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(p)} className="text-indigo-400 hover:text-indigo-300 p-1" title="Editar">
                    <HiOutlinePencil className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(p)} className="text-red-400 hover:text-red-300 p-1 disabled:opacity-40" title="Borrar" disabled={!canDelete}>
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </td>
              </tr>
                ))}
                {bottomSpacerHeight > 0 && (
                  <tr>
                    <td colSpan="6" style={{ height: bottomSpacerHeight }} />
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">{editingProduct ? "Editar Producto" : "Nuevo Producto"}</h2>
            <div className="space-y-4">
              <div>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nombre *" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" required />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
              <div>
                <input type="number" min="0" step="0.01" inputMode="decimal" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="Precio *" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" required />
                {errors.price && <p className="text-xs text-red-400 mt-1">{errors.price}</p>}
              </div>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.cost} onChange={e => setForm({...form, cost: e.target.value})} placeholder="Costo" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" />
              <input type="number" min="0" step="1" inputMode="numeric" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="Stock inicial" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleClose} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg" disabled={isSaving}>Cancelar</button>
              <button onClick={handleReset} className="flex-1 px-4 py-3 bg-slate-700 text-white rounded-lg" disabled={isSaving}>Reset</button>
              <button onClick={handleSave} className="flex-1 px-4 py-3 bg-violet-600 text-white rounded-lg disabled:opacity-60" disabled={isSaving}>
                {isSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Historial de Productos</h2>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="max-h-[420px] overflow-y-auto space-y-2">
              {auditHistory.length === 0 ? (
                <div className="text-slate-500 text-center py-8">Sin registros</div>
              ) : auditHistory.map((entry) => (
                <div key={entry.id} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>{entry.action}</span>
                    <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"}</span>
                  </div>
                  <div className="text-white mt-1">
                    ID: {entry.entity_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
