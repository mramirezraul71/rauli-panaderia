import { createContext, useContext, useState, useEffect } from 'react';
import { UsersDB } from '../db/localDB';
import { db } from '../services/dataService';
import { employees, invites as invitesApi } from '../services/api';
import { addEnrollment, getInvites, markInviteUsed } from '../services/employeeInvites';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'genesis_user';
const LEGACY_USER_STORAGE_KEY = 'rauli_user';
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const hashPassword = async (password) => {
    const data = new TextEncoder().encode(password);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(hash)));
  };

  useEffect(() => {
    const load = async () => {
      try {
        const savedUser = readWithMigration(USER_STORAGE_KEY, LEGACY_USER_STORAGE_KEY);
        if (savedUser) {
          setUser(JSON.parse(savedUser));
          return;
        }
        const existingUsers = await UsersDB.getAll();
        if (existingUsers.length === 0) {
          const defaultUser = { id: 'user_default', username: 'admin', name: 'Administrador', role: 'admin' };
          setUser(defaultUser);
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(defaultUser));
        }
      } catch (e) {
        setUser({ id: 'user_default', username: 'admin', name: 'Administrador', role: 'admin' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const login = async (username, password) => {
    const record = await UsersDB.getByUsername(username);
    if (!record) throw new Error('Usuario no encontrado');
    const hash = await hashPassword(password);
    if (record.password_hash !== hash) throw new Error('Credenciales inválidas');
    const authUser = { id: record.id, username: record.username, name: record.name, role: record.role };
    setUser(authUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  };

  const logout = () => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    setUser(null);
  };

  const registerWithInvite = async ({ inviteCode, username, password, name, email, phone, department, payroll_cycle, hire_date }) => {
    const code = (inviteCode || '').trim().toUpperCase();
    if (!code) throw new Error('Código de invitación requerido');

    let role = 'cajero';
    let usedApi = false;

    try {
      const { data } = await invitesApi.validate(code);
      if (data?.valid && data?.role) {
        role = data.role;
        usedApi = true;
      } else {
        throw new Error(data?.message || 'Código inválido o usado');
      }
    } catch (apiErr) {
      const localInvites = await getInvites();
      const invite = localInvites.find((i) => (i.code || '').toUpperCase() === code && (i.status === 'active' || !i.status));
      if (!invite) throw new Error(apiErr?.message || 'Código inválido o usado');
      role = invite.role || 'cajero';
    }

    const payrollCycle = payroll_cycle || (await db.settings?.get('payroll_cycle'))?.value || 'mensual';

    const passwordHash = await hashPassword(password);
    const created = await UsersDB.create({
      username,
      email,
      name,
      phone,
      role,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    });

    let employeeId = null;
    try {
      const res = await employees.create({
        name,
        email,
        phone,
        position: role,
        department: department || 'Ventas',
        hire_date: hire_date || new Date().toISOString().slice(0, 10),
        salary: 0,
        commission_rate: 0,
        active: 1
      });
      employeeId = res?.data?.employee?.id || null;
    } catch (err) {
      console.warn('No se pudo crear empleado en RRHH:', err);
    }

    if (usedApi) {
      try {
        await invitesApi.use(code, name || username);
      } catch (err) {
        console.warn('No se pudo marcar invitación como usada en API:', err);
      }
    } else {
      await markInviteUsed(code, username);
    }
    await addEnrollment({
      employee_id: employeeId || created.id,
      username,
      role,
      start_date: hire_date ? `${hire_date}T12:00:00.000Z` : new Date().toISOString(),
      payroll_status: 'active',
      payroll_cycle: payrollCycle,
      system: 'standard'
    });

    try {
      await db.auditLog?.add({
        entity_type: 'employee',
        entity_id: employeeId || created.id,
        action: 'enrollment_created',
        user_id: created.id,
        details: {
          invite_code: code,
          role,
          payroll_cycle: payrollCycle
        },
        timestamp: new Date().toISOString()
      });
    } catch (auditError) {
      console.warn('No se pudo registrar auditoría:', auditError);
    }

    const authUser = { id: created.id, username, name, role };
    setUser(authUser);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authUser));
    return authUser;
  };

  const value = {
    user,
    loading,
    isOnline,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isGerente: user?.role === 'gerente',
    isCajero: user?.role === 'cajero',
    isInventario: user?.role === 'inventario',
    login,
    logout,
    registerWithInvite
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}

export default AuthContext;
