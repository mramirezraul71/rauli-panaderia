import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { db } from "../../services/dataService";
import QualityService from "../../services/QualityService";
import PremiumLock from "../../components/PremiumLock";
import { AIEngine } from "../../services/AIEngine";
import { useAuth } from "../../context/AuthContext";
import { formatDate } from "../../config/businessConfig";

const TABS = [
  { id: "inspect", label: "Inspeccionar" },
  { id: "templates", label: "Checklist" },
  { id: "logs", label: "Inspecciones" },
  { id: "nonconformities", label: "No Conformidades" },
  { id: "reports", label: "Reportes ISO" }
];

export default function Quality() {
  const { user } = useAuth();
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const preselectedProduct = params.get("product_id");

  const [activeTab, setActiveTab] = useState("inspect");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [nonConformities, setNonConformities] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState(preselectedProduct || "");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [checklist, setChecklist] = useState([]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiBusy, setAiBusy] = useState(false);

  const [templateDraft, setTemplateDraft] = useState({ name: "", product_id: "", items: [] });
  const [itemDraft, setItemDraft] = useState("");

  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const reportRef = useRef(null);

  const exportCSV = (rows, filename) => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? "").replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportReportPDF = () => {
    const content = reportRef.current?.innerHTML;
    if (!content) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>Reporte ISO 9001</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            h2, h3 { margin: 0 0 12px; }
            .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
            .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
            .muted { color: #6b7280; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; text-align: left; font-size: 12px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
  };

  useEffect(() => {
    const load = async () => {
      const [prodList, userList, tmplList, logList, ncList] = await Promise.all([
        db.products?.where("active").equals(1).toArray() || [],
        db.users?.where("active").equals(1).toArray() || [],
        QualityService.listTemplates(),
        QualityService.listQualityLogs(100),
        QualityService.listNonConformities(100)
      ]);
      setProducts(prodList);
      setUsers(userList);
      setTemplates(tmplList);
      setLogs(logList);
      setNonConformities(ncList);
      if (preselectedProduct) setSelectedProduct(preselectedProduct);
    };
    load();
  }, [preselectedProduct]);

  useEffect(() => {
    if (!selectedTemplate) {
      setChecklist([]);
      return;
    }
    const template = templates.find((t) => t.id === selectedTemplate);
    const items = (template?.items || []).map((label) => ({ label, pass: true }));
    setChecklist(items);
  }, [selectedTemplate, templates]);

  const handleAddItem = () => {
    if (!itemDraft.trim()) return;
    setTemplateDraft((prev) => ({ ...prev, items: [...prev.items, itemDraft.trim()] }));
    setItemDraft("");
  };

  const handleCreateTemplate = async () => {
    if (!templateDraft.name || templateDraft.items.length === 0) return;
    await QualityService.createTemplate({
      name: templateDraft.name,
      product_id: templateDraft.product_id || null,
      items: templateDraft.items
    });
    setTemplateDraft({ name: "", product_id: "", items: [] });
    const list = await QualityService.listTemplates();
    setTemplates(list);
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("¿Eliminar este checklist?")) return;
    await QualityService.deleteTemplate(id);
    setTemplates(await QualityService.listTemplates());
  };

  const handlePhotoSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos((prev) => [...prev, reader.result]);
    reader.readAsDataURL(file);
  };

  const handleAnalyzeDefect = () => {
    fileInputRef.current?.click();
  };

  const handleAIForImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAiBusy(true);
    try {
      const response = await AIEngine.processInput({
        imageFile: file,
        context: "Clasifica el defecto del producto en: Rotura, Color, Dimensiones, Otro."
      });
      setAiSuggestion(response?.text || "Sin sugerencia disponible.");
    } catch (error) {
      setAiSuggestion("No se pudo analizar la imagen.");
    } finally {
      setAiBusy(false);
    }
  };

  const handleDictate = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      alert("Dictado no disponible en este navegador.");
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = recognitionRef.current || new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setNotes((prev) => (prev ? `${prev}\n${transcript}` : transcript));
    };
    recognition.onerror = () => {};
    recognition.start();
    recognitionRef.current = recognition;
  };

  const handleSubmitInspection = async () => {
    if (!selectedProduct || !selectedTemplate) return;
    const payload = await QualityService.createInspection({
      product_id: selectedProduct,
      template_id: selectedTemplate,
      inspector_id: user?.id,
      checklist,
      notes: notes || aiSuggestion,
      photos
    });
    const refreshedLogs = await QualityService.listQualityLogs(100);
    const refreshedNC = await QualityService.listNonConformities(100);
    setLogs(refreshedLogs);
    setNonConformities(refreshedNC);
    setNotes("");
    setPhotos([]);
    setAiSuggestion("");
    alert(payload.result === "approved" ? "Inspección aprobada" : "No conformidad registrada");
  };

  const handleUpdateNC = async (ncId, data) => {
    await QualityService.updateNonConformity(ncId, data, user?.id);
    setNonConformities(await QualityService.listNonConformities(100));
  };

  const handleCloseNC = async (ncId) => {
    if (!confirm("¿Cerrar no conformidad?")) return;
    await QualityService.closeNonConformity(ncId, user?.id);
    setNonConformities(await QualityService.listNonConformities(100));
  };

  const getProductName = (id) => products.find((p) => p.id === id)?.name || id;
  const getUserName = (id) => users.find((u) => u.id === id)?.username || "N/D";
  const getStatusBadge = (status) => status === "approved"
    ? "bg-emerald-500/20 text-emerald-300"
    : "bg-red-500/20 text-red-300";

  const reportStats = useMemo(() => {
    const total = logs.length;
    const approved = logs.filter((l) => l.result === "approved").length;
    const rejected = logs.filter((l) => l.result === "rejected").length;
    const nonConformRate = total > 0 ? Math.round((rejected / total) * 100) : 0;
    const ncOpen = nonConformities.filter((n) => n.status !== "closed").length;
    const ncClosed = nonConformities.filter((n) => n.status === "closed").length;
    const mttrSource = nonConformities.filter((n) => n.closed_at && n.created_at);
    const mttrDays = mttrSource.length
      ? Math.round(
          mttrSource.reduce((sum, n) => sum + (new Date(n.closed_at) - new Date(n.created_at)) / (1000 * 60 * 60 * 24), 0) /
            mttrSource.length
        )
      : 0;
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().split("T")[0];
      const count = logs.filter((l) => (l.created_at || "").startsWith(key)).length;
      return { day: key, count };
    }).reverse();
    const monthlyTrend = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index), 1);
      const key = date.toISOString().slice(0, 7);
      const monthLogs = logs.filter((l) => (l.created_at || "").startsWith(key));
      const approvedCount = monthLogs.filter((l) => l.result === "approved").length;
      const rejectedCount = monthLogs.filter((l) => l.result === "rejected").length;
      return { month: key, total: monthLogs.length, approved: approvedCount, rejected: rejectedCount };
    });
    return { total, approved, rejected, nonConformRate, ncOpen, ncClosed, mttrDays, last7Days, monthlyTrend };
  }, [logs, nonConformities]);

  return (
    <PremiumLock requiredPlan="PRO" title="Control de Calidad">
      <div className="space-y-6 min-h-[calc(100vh-12rem)]">
        <div className="flex flex-wrap gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs ${activeTab === tab.id ? "bg-violet-500/20 text-violet-300" : "bg-slate-800/60 text-slate-300"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "inspect" && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap gap-3 items-center">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Producto</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Checklist</option>
                {templates
                  .filter((t) => !t.product_id || t.product_id === selectedProduct)
                  .map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
              </select>
            </div>

            <div className="grid gap-2">
              {checklist.map((item, index) => (
                <div key={`${item.label}_${index}`} className="flex items-center justify-between bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-slate-200 text-sm">{item.label}</span>
                  <button
                    onClick={() => setChecklist((prev) => prev.map((c, i) => i === index ? { ...c, pass: !c.pass } : c))}
                    className={`px-3 py-1 rounded-full text-xs ${item.pass ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}
                  >
                    {item.pass ? "Pasa" : "No pasa"}
                  </button>
                </div>
              ))}
              {checklist.length === 0 && (
                <div className="text-slate-500 text-sm">Selecciona un checklist para iniciar.</div>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={handleAnalyzeDefect}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                📷 Analizar defecto
              </button>
              <button
                onClick={handleDictate}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
              >
                🎤 Dictar hallazgo
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAIForImage} className="hidden" />
            <input type="file" accept="image/*" onChange={handlePhotoSelect} className="text-xs text-slate-400" />

            {aiSuggestion && (
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300">
                {aiBusy ? "Analizando..." : `Sugerencia IA: ${aiSuggestion}`}
              </div>
            )}

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas de inspección"
              className="w-full min-h-[100px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />

            <div className="flex flex-wrap gap-2">
              {photos.map((src, idx) => (
                <img key={idx} src={src} alt="evidencia" className="w-20 h-20 object-cover rounded-lg border border-slate-700" />
              ))}
            </div>

            <button
              onClick={handleSubmitInspection}
              disabled={!selectedProduct || !selectedTemplate}
              className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm disabled:opacity-50"
            >
              Finalizar inspección
            </button>
          </div>
        )}

        {activeTab === "templates" && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <input
                value={templateDraft.name}
                onChange={(e) => setTemplateDraft((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Nombre del checklist"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
              <select
                value={templateDraft.product_id}
                onChange={(e) => setTemplateDraft((prev) => ({ ...prev, product_id: e.target.value }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Producto (opcional)</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={itemDraft}
                  onChange={(e) => setItemDraft(e.target.value)}
                  placeholder="Nuevo ítem"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <button onClick={handleAddItem} className="px-3 py-2 bg-slate-700 text-white rounded-lg text-sm">
                  Agregar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {templateDraft.items.map((item, idx) => (
                <span key={`${item}_${idx}`} className="text-xs bg-slate-900 border border-slate-700 rounded-full px-3 py-1 text-slate-300">
                  {item}
                </span>
              ))}
            </div>

            <button onClick={handleCreateTemplate} className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm">
              Guardar checklist
            </button>

            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((tmpl) => (
                <div key={tmpl.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-white text-sm font-medium">{tmpl.name}</h4>
                    <button onClick={() => handleDeleteTemplate(tmpl.id)} className="text-xs text-red-300">
                      Eliminar
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Producto: {tmpl.product_id ? getProductName(tmpl.product_id) : "General"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(tmpl.items || []).map((item, idx) => (
                      <span key={`${tmpl.id}_${idx}`} className="text-xs bg-slate-800 border border-slate-700 rounded-full px-2 py-1 text-slate-300">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="text-slate-500 text-sm">No hay checklists creados.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === "logs" && (
          <div className="grid gap-3">
            {logs.map((log) => (
              <div key={log.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{getProductName(log.product_id)}</p>
                    <p className="text-xs text-slate-400">{formatDate(log.created_at)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${getStatusBadge(log.result)}`}>
                    {log.result === "approved" ? "Aprobado" : "Rechazado"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">Inspector: {getUserName(log.inspector_id)}</p>
              </div>
            ))}
            {logs.length === 0 && <div className="text-slate-500 text-sm">Sin inspecciones registradas.</div>}
          </div>
        )}

        {activeTab === "nonconformities" && (
          <div className="grid gap-3">
            {nonConformities.map((nc) => (
              <div key={nc.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm">{getProductName(nc.product_id)}</p>
                    <p className="text-xs text-slate-400">{formatDate(nc.created_at)}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${nc.status === "closed" ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"}`}>
                    {nc.status === "closed" ? "Cerrado" : "Abierto"}
                  </span>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input
                    defaultValue={nc.root_cause || ""}
                    onBlur={(e) => handleUpdateNC(nc.id, { root_cause: e.target.value })}
                    placeholder="Causa raíz"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    defaultValue={nc.corrective_action || ""}
                    onBlur={(e) => handleUpdateNC(nc.id, { corrective_action: e.target.value })}
                    placeholder="Acción correctiva"
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                {nc.status !== "closed" && (
                  <button onClick={() => handleCloseNC(nc.id)} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs">
                    Cerrar no conformidad
                  </button>
                )}
              </div>
            ))}
            {nonConformities.length === 0 && <div className="text-slate-500 text-sm">Sin no conformidades.</div>}
          </div>
        )}

        {activeTab === "reports" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  exportCSV(
                    logs.map((l) => ({
                      id: l.id,
                      producto: getProductName(l.product_id),
                      inspector: getUserName(l.inspector_id),
                      resultado: l.result,
                      fecha: l.created_at
                    })),
                    "inspecciones_iso.csv"
                  )
                }
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                Exportar inspecciones CSV
              </button>
              <button
                onClick={() =>
                  exportCSV(
                    nonConformities.map((n) => ({
                      id: n.id,
                      producto: getProductName(n.product_id),
                      estado: n.status,
                      causa_raiz: n.root_cause || "",
                      accion_correctiva: n.corrective_action || "",
                      creado: n.created_at,
                      cerrado: n.closed_at || ""
                    })),
                    "no_conformidades_iso.csv"
                  )
                }
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                Exportar no conformidades CSV
              </button>
              <button
                onClick={exportReportPDF}
                className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs"
              >
                Exportar reporte PDF
              </button>
            </div>

            <div ref={reportRef} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Reporte ISO 9001</h2>
                <p className="text-xs text-slate-400">Indicadores de calidad y no conformidades.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Inspecciones</p>
                  <p className="text-lg text-white font-semibold">{reportStats.total}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Aprobadas</p>
                  <p className="text-lg text-emerald-300 font-semibold">{reportStats.approved}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Rechazadas</p>
                  <p className="text-lg text-red-300 font-semibold">{reportStats.rejected}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">Tasa no conformidad</p>
                  <p className="text-lg text-white font-semibold">{reportStats.nonConformRate}%</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">No conformidades abiertas</p>
                  <p className="text-lg text-red-300 font-semibold">{reportStats.ncOpen}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">No conformidades cerradas</p>
                  <p className="text-lg text-emerald-300 font-semibold">{reportStats.ncClosed}</p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <p className="text-xs text-slate-400">MTTR (días)</p>
                  <p className="text-lg text-white font-semibold">{reportStats.mttrDays}</p>
                </div>
              </div>
              <div>
                <h3 className="text-white font-medium">Inspecciones últimos 7 días</h3>
                <div className="grid gap-2 md:grid-cols-7">
                  {reportStats.last7Days.map((item) => (
                    <div key={item.day} className="bg-slate-900/60 border border-slate-700 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">{item.day}</p>
                      <p className="text-sm text-white font-semibold">{item.count}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-white font-medium">Tendencia mensual (6 meses)</h3>
                <div className="grid gap-2 md:grid-cols-6">
                  {reportStats.monthlyTrend.map((item) => (
                    <div key={item.month} className="bg-slate-900/60 border border-slate-700 rounded-lg p-2 text-center">
                      <p className="text-xs text-slate-400">{item.month}</p>
                      <p className="text-sm text-white font-semibold">{item.total}</p>
                      <p className="text-xs text-emerald-300">Aprobadas: {item.approved}</p>
                      <p className="text-xs text-red-300">Rechazadas: {item.rejected}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PremiumLock>
  );
}
