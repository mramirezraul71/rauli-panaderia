import { useMemo, useRef, useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { HiOutlinePencil, HiOutlineTrash } from "react-icons/hi";
import { db, logAudit } from "../services/dataService";
import { useAuth } from "../context/AuthContext";
import { useCommandCenter } from "../context/CommandCenterContext";
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";

export default function Customers() {
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
  const [customers, setCustomers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const defaultForm = { name: "", phone: "", email: "" };
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const draftKey = "genesis_customer_draft";
  const legacyDraftKey = "rauli_customer_draft";
  const [selectedIds, setSelectedIds] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const listRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const [columns, setColumns] = useState(3);
  const rowHeight = 180;
  const canDelete = ["admin", "gerente"].includes(user?.role);

  useEffect(() => {
    loadCustomers();
  }, []);


  const loadCustomers = async () => {
    try {
      const data = await db.customers?.where("active").equals(1).toArray() || [];
      setCustomers(data);
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    const nextErrors = {};
    if (!form.name.trim()) nextErrors.name = "Nombre requerido";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    try {
      setIsSaving(true);
      if (editingCustomer) {
        await db.customers.update(editingCustomer.id, { ...form });
        try {
          await logAudit("customer", editingCustomer.id, "update", user?.id, {
            before: editingCustomer,
            after: { ...form }
          });
        } catch {}
      } else {
        const newCustomer = { ...form, active: 1, balance: 0, created_at: new Date().toISOString(), deleted_at: null };
        const id = await db.customers.add(newCustomer);
        try { await logAudit("customer", id, "create", user?.id, newCustomer); } catch {}
      }
      setForm(defaultForm);
      setEditingCustomer(null);
      setErrors({});
      try { localStorage.removeItem(draftKey); } catch {}
      setShowModal(false);
      loadCustomers();
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || ""
    });
    setShowModal(true);
  };

  const handleDelete = async (customer) => {
    if (!confirm("¿Seguro?")) return;
    try {
      await db.customers.update(customer.id, { active: 0, deleted_at: new Date().toISOString() });
      try { await logAudit("customer", customer.id, "delete", user?.id, { before: customer }); } catch {}
      loadCustomers();
    } catch (e) { console.error(e); }
  };

  const handleBulkDelete = async () => {
    if (!canDelete) return;
    if (selectedIds.length === 0) return;
    if (!confirm("¿Seguro? Se eliminarán los clientes seleccionados.")) return;
    try {
      await Promise.all(
        selectedIds.map(id => db.customers.update(id, { active: 0, deleted_at: new Date().toISOString() }))
      );
      try { await logAudit("customer", "bulk", "delete", user?.id, { ids: selectedIds }); } catch {}
      setSelectedIds([]);
      loadCustomers();
    } catch (e) { console.error(e); }
  };

  const exportCustomersCSV = (rows) => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const header = ["Nombre", "Telefono", "Email", "Saldo"];
    const lines = [
      header.join(","),
      ...rows.map(c => [
        escape(c.name),
        escape(c.phone || ""),
        escape(c.email || ""),
        escape(c.balance ?? 0)
      ].join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "clientes.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setForm(defaultForm);
    setEditingCustomer(null);
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
    const unsubscribe = on("OPEN_CUSTOMER_MODAL", () => {
      handleReset();
      setShowModal(true);
    });
    return () => unsubscribe();
  }, [on, handleReset]);

  useEffect(() => {
    if (!showModal || editingCustomer) return;
    try {
      const saved = readWithMigration(draftKey, legacyDraftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm({ ...defaultForm, ...parsed });
      }
    } catch {}
  }, [showModal, editingCustomer]);

  useEffect(() => {
    if (!showModal || editingCustomer) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
    } catch {}
  }, [form, showModal, editingCustomer]);

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

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter(c => {
      const name = (c.name || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      return name.includes(term) || phone.includes(term) || email.includes(term);
    });
  }, [customers, search]);

  const filteredIds = useMemo(() => filteredCustomers.map(c => c.id), [filteredCustomers]);
  const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(selectedIds.filter(id => !filteredIds.includes(id)));
    } else {
      const merged = new Set([...selectedIds, ...filteredIds]);
      setSelectedIds(Array.from(merged));
    }
  };

  useEffect(() => {
    const computeColumns = () => {
      const width = window.innerWidth;
      if (width >= 1024) return 3;
      if (width >= 768) return 2;
      return 1;
    };
    const update = () => setColumns(computeColumns());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const handleScroll = () => setScrollTop(el.scrollTop);
    const handleResize = () => setViewportHeight(el.clientHeight || 600);
    handleResize();
    el.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleResize);
    return () => {
      el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const itemsPerRow = Math.max(1, columns);
  const totalRows = Math.ceil(filteredCustomers.length / itemsPerRow);
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
  const visibleRows = Math.ceil(viewportHeight / rowHeight) + 3;
  const endRow = Math.min(totalRows, startRow + visibleRows);
  const startIndex = startRow * itemsPerRow;
  const endIndex = Math.min(filteredCustomers.length, endRow * itemsPerRow);
  const visibleCustomers = filteredCustomers.slice(startIndex, endIndex);
  const topSpacerHeight = startRow * rowHeight;
  const bottomSpacerHeight = Math.max(0, (totalRows - endRow) * rowHeight);

  const auditHistory = useLiveQuery(async () => {
    const rows = await db.auditLog?.where("entity_type").equals("customer").toArray() || [];
    return rows
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 50);
  }, []) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.customers", "Clientes")}</h1>
          <p className="text-sm text-slate-400">{customers.length} clientes registrados</p>
        </div>
        <div className="flex flex-1 min-w-[240px] max-w-2xl items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
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
        <button onClick={() => { handleReset(); setShowModal(true); }} className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg">+ Nuevo Cliente</button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-3">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <button
            onClick={toggleSelectAll}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg"
          >
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </button>
          <span>{selectedIds.length} seleccionados</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
          >
            Ver historial
          </button>
          <button
            onClick={() => exportCustomersCSV(selectedIds.length ? customers.filter(c => selectedIds.includes(c.id)) : filteredCustomers)}
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
        className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 min-h-[520px] max-h-[calc(100vh-18rem)] overflow-y-auto"
      >
        {customers.length === 0 ? (
          <div className="col-span-full bg-slate-900/60 rounded-xl p-8 border border-slate-700/60 text-center text-slate-500">
            No hay clientes registrados
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-slate-900/60 rounded-xl p-8 border border-slate-700/60 text-center text-slate-500">
            Sin resultados para "{search}"
          </div>
        ) : (
          <div className="relative">
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}
            <div className={`grid gap-4 ${columns === 3 ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : columns === 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
              {visibleCustomers.map(c => (
                <div key={c.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-white">{c.name}</h3>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => setSelectedIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                    />
                  </div>
                  <p className="text-sm text-slate-400">{c.phone || "Sin telefono"}</p>
                  <p className="text-sm text-slate-400">{c.email || "Sin email"}</p>
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <span className={`text-lg font-bold ${(c.balance || 0) > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      Saldo: {formatCurrency(c.balance)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button onClick={() => handleEdit(c)} className="text-indigo-400 hover:text-indigo-300 p-1" title="Editar">
                      <HiOutlinePencil className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleDelete(c)} className="text-red-400 hover:text-red-300 p-1 disabled:opacity-40" title="Borrar" disabled={!canDelete}>
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
          </div>
        )}
      </div>
      {showHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Historial de Clientes</h2>
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
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">{editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}</h2>
            <div className="space-y-4">
              <div>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Nombre *" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" required />
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>
              <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Telefono" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" />
              <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="Email" className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white" />
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
    </div>
  );
}
