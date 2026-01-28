import { useState, useEffect } from "react";
import { HiOutlineShieldCheck, HiOutlineLockClosed, HiOutlineUserGroup, HiOutlinePencil, HiOutlineCheck, HiOutlineX } from "react-icons/hi";
import { UsersDB } from "../db/localDB";
import { useAuth } from "../context/AuthContext";
import toast from "react-hot-toast";

const ROLE_CONFIG = {
  admin: {
    label: "Administrador",
    color: "from-red-600 to-rose-600",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/10",
    textColor: "text-red-400",
    icon: "🔑",
    permissions: ["all"]
  },
  gerente: {
    label: "Gerente",
    color: "from-violet-600 to-purple-600",
    borderColor: "border-violet-500/30",
    bgColor: "bg-violet-500/10",
    textColor: "text-violet-400",
    icon: "👔",
    permissions: ["view_reports", "manage_inventory", "manage_sales"]
  },
  cajero: {
    label: "Cajero",
    color: "from-emerald-600 to-teal-600",
    borderColor: "border-emerald-500/30",
    bgColor: "bg-emerald-500/10",
    textColor: "text-emerald-400",
    icon: "💰",
    permissions: ["pos", "view_sales"]
  },
  inventario: {
    label: "Inventario",
    color: "from-blue-600 to-cyan-600",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/10",
    textColor: "text-blue-400",
    icon: "📦",
    permissions: ["manage_inventory", "view_products"]
  }
};

export default function AccessControlWidget() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({ total: 0, admins: 0, active: 0 });
  const [editingRole, setEditingRole] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const allUsers = await UsersDB.getAll();
      setUsers(allUsers);
      setStats({
        total: allUsers.length,
        admins: allUsers.filter(u => u.role === "admin").length,
        active: allUsers.filter(u => u.active === 1).length
      });
    } catch (e) {
      console.error("Error loading users:", e);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (user?.role !== "admin") {
      toast.error("Solo el administrador puede cambiar roles");
      return;
    }
    try {
      await UsersDB.update(userId, { role: newRole });
      toast.success("Rol actualizado");
      setEditingRole(null);
      loadUsers();
    } catch (e) {
      toast.error("Error al actualizar rol");
    }
  };

  const handleToggleActive = async (userId, currentActive) => {
    if (user?.role !== "admin") {
      toast.error("Solo el administrador puede activar/desactivar usuarios");
      return;
    }
    try {
      await UsersDB.update(userId, { active: currentActive === 1 ? 0 : 1 });
      toast.success(currentActive === 1 ? "Usuario desactivado" : "Usuario activado");
      loadUsers();
    } catch (e) {
      toast.error("Error al cambiar estado");
    }
  };

  const isOwner = user?.role === "admin";

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/50 bg-gradient-to-r from-violet-600/10 to-indigo-600/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
              <HiOutlineShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Centro de Control de Acceso
                {isOwner && <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full border border-red-500/30">DUEÑO</span>}
              </h3>
              <p className="text-sm text-slate-400">Gestión de roles y permisos del equipo</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all"
          >
            {showDetails ? "Ocultar" : "Ver todo"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3 border-b border-slate-700/50">
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineUserGroup className="w-4 h-4 text-violet-400" />
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-red-500/10 rounded-xl p-3 border border-red-500/30">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineShieldCheck className="w-4 h-4 text-red-400" />
            <p className="text-xs text-slate-400">Admins</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.admins}</p>
        </div>
        <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/30">
          <div className="flex items-center gap-2 mb-1">
            <HiOutlineCheck className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-slate-400">Activos</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
        </div>
      </div>

      {/* User List (Expandable) */}
      {showDetails && (
        <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
          {users.length === 0 ? (
            <div className="text-center py-8">
              <HiOutlineLockClosed className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No hay usuarios registrados</p>
            </div>
          ) : (
            users.map((u) => {
              const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.cajero;
              const isEditing = editingRole === u.id;
              
              return (
                <div
                  key={u.id}
                  className={`p-4 rounded-xl border transition-all ${
                    u.active === 1 
                      ? `${roleConfig.bgColor} ${roleConfig.borderColor}` 
                      : "bg-slate-800/30 border-slate-700/30 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-2xl">{roleConfig.icon}</div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{u.name || u.username}</p>
                        <p className="text-xs text-slate-400">@{u.username}</p>
                      </div>
                    </div>
                    
                    {!isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleConfig.bgColor} ${roleConfig.textColor} border ${roleConfig.borderColor}`}>
                          {roleConfig.label}
                        </span>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => setEditingRole(u.id)}
                              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                              title="Cambiar rol"
                            >
                              <HiOutlinePencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(u.id, u.active)}
                              className={`p-2 rounded-lg transition-all ${
                                u.active === 1 
                                  ? "hover:bg-red-500/20 text-slate-400 hover:text-red-400" 
                                  : "hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400"
                              }`}
                              title={u.active === 1 ? "Desactivar" : "Activar"}
                            >
                              {u.active === 1 ? <HiOutlineX className="w-4 h-4" /> : <HiOutlineCheck className="w-4 h-4" />}
                            </button>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {Object.keys(ROLE_CONFIG).map((role) => (
                          <button
                            key={role}
                            onClick={() => handleRoleChange(u.id, role)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                              u.role === role 
                                ? `${ROLE_CONFIG[role].bgColor} ${ROLE_CONFIG[role].textColor} border ${ROLE_CONFIG[role].borderColor}` 
                                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                          >
                            {ROLE_CONFIG[role].icon} {ROLE_CONFIG[role].label}
                          </button>
                        ))}
                        <button
                          onClick={() => setEditingRole(null)}
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                        >
                          <HiOutlineX className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Permissions preview */}
                  {showDetails && (
                    <div className="mt-2 pt-2 border-t border-slate-700/30">
                      <p className="text-xs text-slate-500 mb-1">Permisos:</p>
                      <div className="flex flex-wrap gap-1">
                        {roleConfig.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="text-[10px] px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded-full"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Footer - Security Status */}
      <div className="p-4 bg-slate-900/50 border-t border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-lg shadow-emerald-500/50" />
            <p className="text-xs text-slate-400">
              Sistema seguro · {stats.active} usuarios activos
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-violet-400 hover:text-violet-300 transition-all"
            >
              {showDetails ? "Cerrar panel" : "Gestionar accesos"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
