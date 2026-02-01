/**
 * Circuito cerrado: descarga de roles por código.
 * El dueño genera un enlace desde su pantalla; invita por WhatsApp; el integrante abre en navegador y queda con ese rol.
 */
import { useState, useEffect } from "react";
import { HiOutlineLink, HiOutlineClipboardCopy, HiOutlineRefresh } from "react-icons/hi";
import toast from "react-hot-toast";
import { invites } from "../services/api";

const ROLE_LABELS = {
  admin: "Dueño · Admin",
  gerente: "Gerencia · Supervisor",
  cajero: "Cajero · Caja",
  inventario: "Inventario · Stock",
  produccion: "Producción · Horno",
};

const ROLE_OPTIONS = [
  { value: "cajero", label: "Cajero · Caja" },
  { value: "inventario", label: "Inventario · Stock" },
  { value: "produccion", label: "Producción · Horno" },
  { value: "gerente", label: "Gerencia · Supervisor" },
];

function getAppBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname.replace(/\/$/, "") || window.location.origin;
}

export default function InviteTeamSection() {
  const [role, setRole] = useState("cajero");
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(null);

  const loadList = async () => {
    setLoading(true);
    try {
      const { data } = await invites.list();
      setList(data?.invites || []);
      setApiAvailable(true);
    } catch (e) {
      setApiAvailable(false);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await invites.create(role);
      const inv = data?.invite;
      if (inv) {
        toast.success("Enlace generado");
        loadList();
      }
    } catch (e) {
      toast.error(e?.message || "Error al generar enlace. ¿Backend conectado?");
    } finally {
      setCreating(false);
    }
  };

  const getJoinUrl = (code) => {
    return `${getAppBaseUrl()}/login?invite=${encodeURIComponent(code)}`;
  };

  const handleCopy = (code) => {
    const url = getJoinUrl(code);
    navigator.clipboard.writeText(url).then(
      () => toast.success("Enlace copiado"),
      () => toast.error("No se pudo copiar")
    );
  };

  const handleWhatsApp = (code, roleLabel) => {
    const url = getJoinUrl(code);
    const text = `Únete a RAULI como ${roleLabel}. Abre este enlace en tu navegador:\n${url}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  const handleRevoke = async (code) => {
    if (!confirm("¿Revocar este enlace? Quien no haya entrado ya no podrá usarlo.")) return;
    try {
      await invites.revoke(code);
      toast.success("Enlace revocado");
      loadList();
    } catch (e) {
      toast.error(e?.message || "Error al revocar");
    }
  };

  const statusLabel = (inv) => {
    if (inv.status === "used") return `Usado${inv.used_by ? ` por ${inv.used_by}` : ""}${inv.used_at ? ` · ${new Date(inv.used_at).toLocaleDateString("es-ES")}` : ""}`;
    if (inv.status === "revoked") return "Revocado";
    return "Pendiente";
  };

  if (apiAvailable === false) {
    return (
      <div className="p-4 rounded-xl border-2 border-amber-500/40 bg-amber-500/10">
        <p className="text-sm text-amber-200">
          <strong>Descarga de roles por enlace</strong> requiere que el backend esté conectado. Conecta la API para generar códigos desde aquí y controlar quién entra con cada rol.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 sm:border border-slate-600/80 sm:border-slate-700/50 bg-slate-800/60 overflow-hidden">
      <div className="p-4 sm:p-6 border-b-2 sm:border-b border-slate-600/80 sm:border-slate-700/50 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
        <div className="flex items-center gap-3">
          <HiOutlineLink className="w-6 h-6 text-violet-400" />
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">Invitar equipo por enlace</h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Genera un código por rol. Envía el enlace por WhatsApp; el integrante abre en el navegador y queda con ese rol. Circuito cerrado: tú controlas desde aquí.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="text-sm text-slate-400">Rol para el enlace:</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg disabled:opacity-50"
          >
            {creating ? "Generando…" : "Generar enlace"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadList}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:text-white disabled:opacity-50"
            title="Actualizar lista"
          >
            <HiOutlineRefresh className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-500">Lista de enlaces generados</span>
        </div>

        {loading && list.length === 0 ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay enlaces. Genera uno arriba y envíalo por WhatsApp.</p>
        ) : (
          <ul className="space-y-3 max-h-64 overflow-y-auto">
            {list.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-slate-600/60 bg-slate-800/50"
              >
                <span className="font-mono text-sm text-violet-300">{inv.code}</span>
                <span className="text-sm text-slate-400">{ROLE_LABELS[inv.role] || inv.role}</span>
                <span className={`text-xs ${inv.status === "pending" ? "text-amber-400" : inv.status === "used" ? "text-emerald-400" : "text-slate-500"}`}>
                  {statusLabel(inv)}
                </span>
                {inv.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleCopy(inv.code)}
                      className="p-1.5 rounded-lg bg-slate-700 text-slate-300 hover:text-white"
                      title="Copiar enlace"
                    >
                      <HiOutlineClipboardCopy className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleWhatsApp(inv.code, ROLE_LABELS[inv.role] || inv.role)}
                      className="px-2 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-medium"
                    >
                      Enviar por WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRevoke(inv.code)}
                      className="px-2 py-1 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-red-300 text-xs"
                    >
                      Revocar
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
