/**
 * GENESIS - Employees/HR Management Page
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  HiOutlineUsers, HiOutlinePlus, HiOutlineRefresh, HiOutlineCash,
  HiOutlineCalendar, HiOutlineClock, HiOutlineChartBar, HiOutlineX,
  HiOutlineCheck, HiOutlinePencil, HiOutlineUserCircle,
  HiOutlineClipboardCopy, HiOutlineTrash
} from 'react-icons/hi';
import { employees } from '../services/api';
import { db } from '../services/dataService';
import { formatCurrency } from "../config/businessConfig";
import { t } from "../i18n";
import { addInvite, deleteInvite, getInvites, saveInvites, updateInvite } from '../services/employeeInvites';
import { getEnrollments } from '../services/employeeInvites';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartBar },
  { id: 'employees', label: 'Empleados', icon: HiOutlineUsers },
  { id: 'invites', label: 'Invitaciones', icon: HiOutlineUsers },
  { id: 'schedules', label: 'Horarios', icon: HiOutlineCalendar },
  { id: 'commissions', label: 'Comisiones', icon: HiOutlineCash },
  { id: 'payroll', label: 'Nómina', icon: HiOutlineClock },
];

export default function Employees() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [employeeList, setEmployeeList] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [invites, setInvites] = useState([]);
  const [inviteDraft, setInviteDraft] = useState({ name: '', email: '', phone: '', role: 'cajero', status: 'active', payroll_cycle: 'mensual' });
  const [enrollments, setEnrollments] = useState([]);
  const [payrollCycle, setPayrollCycle] = useState('mensual');
  const [payrollSystem, setPayrollSystem] = useState('mensual');
  const [payrollSystemCustom, setPayrollSystemCustom] = useState('');
  const [payrollError, setPayrollError] = useState('');
  const [payrollConfigured, setPayrollConfigured] = useState(false);
  const [payrollRules, setPayrollRules] = useState({
    hourly: false,
    overtimeMultiplier: 1.5,
    nightMultiplier: 1.25,
    weekendMultiplier: 1.5,
    performanceBonus: 'none',
    profitSharePercent: 0,
    deductionsPercent: 0,
    employerContributionPercent: 0
  });
  const [attendanceConfig, setAttendanceConfig] = useState({
    manual: true,
    mobileFingerprint: false,
    mobileFace: false,
    geoFence: false,
    externalFingerprintReader: false,
    qrCheckIn: true,
    nfcCheckIn: false,
    notes: ""
  });
  
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showPayrollWizard, setShowPayrollWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardScope, setWizardScope] = useState('global');
  const [wizardEmployeeId, setWizardEmployeeId] = useState('');
  const [wizardPayrollCycle, setWizardPayrollCycle] = useState('mensual');
  const [wizardPayrollSystem, setWizardPayrollSystem] = useState('mensual');
  const [wizardPayrollSystemCustom, setWizardPayrollSystemCustom] = useState('');
  const [wizardPayrollRules, setWizardPayrollRules] = useState({
    hourly: false,
    overtimeMultiplier: 1.5,
    nightMultiplier: 1.25,
    weekendMultiplier: 1.5,
    performanceBonus: 'none',
    profitSharePercent: 0,
    deductionsPercent: 0,
    employerContributionPercent: 0
  });
  const [wizardUseGlobal, setWizardUseGlobal] = useState(true);
  const [editingEmployee, setEditingEmployee] = useState(null);
  
  const [scheduleFilter, setScheduleFilter] = useState({ start_date: getWeekStart(), end_date: getWeekEnd() });

  function getWeekStart() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }
  
  function getWeekEnd() {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 6);
    return d.toISOString().split('T')[0];
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (activeTab === 'employees') loadEmployees();
    if (activeTab === 'invites') loadInvites();
    if (activeTab === 'schedules') loadSchedules();
    if (activeTab === 'commissions') loadCommissions();
    if (activeTab === 'payroll') loadPayrolls();
  }, [activeTab, scheduleFilter]);

  useEffect(() => {
    const loadAttendanceConfig = async () => {
      try {
        const stored = await db.settings?.get("attendance_methods");
        if (stored?.value) {
          setAttendanceConfig({ ...attendanceConfig, ...JSON.parse(stored.value) });
        }
        const payrollCfg = await db.settings?.get("payroll_system");
        const payrollCycleStored = await db.settings?.get("payroll_cycle");
        const payrollCustom = await db.settings?.get("payroll_system_custom");
        const payrollRulesStored = await db.settings?.get("payroll_rules");
        const payrollConfiguredStored = await db.settings?.get("payroll_configured");
        if (payrollCycleStored?.value) setPayrollCycle(payrollCycleStored.value);
        if (payrollCfg?.value) setPayrollSystem(payrollCfg.value);
        if (payrollCustom?.value) setPayrollSystemCustom(payrollCustom.value);
        if (payrollRulesStored?.value) setPayrollRules({ ...payrollRules, ...JSON.parse(payrollRulesStored.value) });
        if (payrollConfiguredStored?.value) setPayrollConfigured(payrollConfiguredStored.value === "true");
      } catch (err) {
        console.error('Error loading attendance config:', err);
      }
    };
    loadAttendanceConfig();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
    if (params.get('wizard') === '1') {
      setActiveTab('payroll');
      openPayrollWizard('auto');
    }
  }, [location.search]);

  const openPayrollWizard = (scope = 'auto') => {
    const resolvedScope = scope === 'auto'
      ? (employeeList.length > 0 ? 'employee' : 'global')
      : scope;
    setWizardStep(1);
    setWizardScope(resolvedScope);
    setWizardEmployeeId('');
    setWizardPayrollCycle(payrollCycle);
    setWizardPayrollSystem(payrollSystem);
    setWizardPayrollSystemCustom(payrollSystemCustom);
    setWizardPayrollRules({ ...payrollRules });
    setWizardUseGlobal(true);
    setShowPayrollWizard(true);
  };

  const handleWizardEmployeeChange = (employeeId) => {
    setWizardEmployeeId(employeeId);
    const target = employeeList.find((emp) => emp.id === employeeId);
    if (!target) return;
    const hasCustom = Boolean(target.payroll_system || target.payroll_rules || target.payroll_cycle);
    setWizardUseGlobal(!hasCustom);
    setWizardPayrollCycle(target.payroll_cycle || payrollCycle);
    setWizardPayrollSystem(target.payroll_system || payrollSystem);
    setWizardPayrollSystemCustom(target.payroll_system_custom || payrollSystemCustom);
    try {
      const parsed = target.payroll_rules ? JSON.parse(target.payroll_rules) : null;
      setWizardPayrollRules(parsed ? { ...payrollRules, ...parsed } : { ...payrollRules });
    } catch {
      setWizardPayrollRules({ ...payrollRules });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, shiftsRes] = await Promise.all([
        employees.dashboard(),
        employees.shifts()
      ]);
      setDashboard(dashRes.data.dashboard);
      setShifts(shiftsRes.data.shifts || []);
    } catch (err) {
      console.error('Error loading HR data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await employees.list({ active: 'all' });
      setEmployeeList(res.data.employees || []);
    } catch (err) { console.error('Error loading employees:', err); }
  };

  const loadInvites = async () => {
    try {
      const list = await getInvites();
      setInvites(list || []);
      const enrollmentList = await getEnrollments();
      setEnrollments(enrollmentList || []);
    } catch (err) {
      console.error('Error loading invites:', err);
    }
  };

  const handleCreateInvite = async () => {
    const code = `EMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const invite = {
      code,
      name: inviteDraft.name,
      email: inviteDraft.email,
      phone: inviteDraft.phone,
      role: inviteDraft.role,
        payroll_cycle: inviteDraft.payroll_cycle,
      status: inviteDraft.status || 'active',
      created_at: new Date().toISOString()
    };
    const updated = await addInvite(invite);
    setInvites(updated);
    setInviteDraft({ name: '', email: '', phone: '', role: 'cajero', status: 'active', payroll_cycle: 'mensual' });
  };

  const handleUpdateInvite = async (code, changes) => {
    const updated = await updateInvite(code, changes);
    setInvites(updated);
  };

  const handleDeleteInvite = async (code) => {
    if (!confirm('¿Eliminar invitación?')) return;
    const updated = await deleteInvite(code);
    setInvites(updated);
  };

  const handleCopyLink = async (code) => {
    const link = `${window.location.origin}/login?invite=${code}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      console.error('Error copying invite link:', err);
    }
  };

  const handleRegenerateInvite = async (invite) => {
    if (invite.status === 'used') return;
    const newCode = `EMP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const updated = await deleteInvite(invite.code);
    const nextInvite = {
      ...invite,
      code: newCode,
      created_at: new Date().toISOString()
    };
    const finalList = [...updated, nextInvite];
    await saveInvites(finalList);
    setInvites(finalList);
  };

  const loadSchedules = async () => {
    try {
      const res = await employees.schedules(scheduleFilter);
      setSchedules(res.data.schedules || []);
    } catch (err) { console.error('Error loading schedules:', err); }
  };

  const loadCommissions = async () => {
    try {
      const res = await employees.commissions({});
      setCommissions(res.data.commissions || []);
    } catch (err) { console.error('Error loading commissions:', err); }
  };

  const loadPayrolls = async () => {
    try {
      const res = await employees.payroll({});
      setPayrolls(res.data.payrolls || []);
    } catch (err) { console.error('Error loading payrolls:', err); }
  };

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'approved': 'bg-blue-500/20 text-blue-400',
      'paid': 'bg-green-500/20 text-green-400',
      'draft': 'bg-slate-500/20 text-slate-400',
      'scheduled': 'bg-blue-500/20 text-blue-400',
      'working': 'bg-green-500/20 text-green-400',
      'completed': 'bg-green-500/20 text-green-400',
    };
    return styles[status] || 'bg-slate-500/20 text-slate-400';
  };

  // ==================== TAB COMPONENTS ====================
  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Empleados Activos" value={dashboard?.active_employees || 0} icon={HiOutlineUsers} color="blue" />
        <StatCard title="Comisiones Pendientes" value={formatCurrency(dashboard?.pending_commissions?.total)} icon={HiOutlineCash} color="yellow" />
        <StatCard title="Turnos Hoy" value={dashboard?.today_schedules?.length || 0} icon={HiOutlineCalendar} color="green" />
        <StatCard title="Total Comisiones" value={dashboard?.pending_commissions?.count || 0} icon={HiOutlineChartBar} color="purple" />
      </div>

      {/* Today's Schedules */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-4">Turnos de Hoy</h3>
        <div className="grid gap-2">
          {(dashboard?.today_schedules || []).map(sch => (
            <div key={sch.id} className="flex justify-between items-center bg-slate-700/30 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <HiOutlineUserCircle className="w-8 h-8 text-slate-400" />
                <div>
                  <span className="font-medium text-white">{sch.employee_name}</span>
                  <span className="text-slate-400 ml-2 text-sm">{sch.shift_name}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-indigo-400 font-mono">{sch.start_time} - {sch.end_time}</span>
                {sch.actual_start && <span className="text-green-400 ml-2 text-sm">✓ Entrada: {sch.actual_start}</span>}
              </div>
            </div>
          ))}
          {(dashboard?.today_schedules || []).length === 0 && (
            <p className="text-slate-500 text-center py-4">No hay turnos programados para hoy</p>
          )}
        </div>
      </div>

      {/* Top Sellers */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-4">Top Vendedores del Mes</h3>
        <div className="space-y-2">
          {(dashboard?.top_sellers || []).map((seller, idx) => (
            <div key={seller.code} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : idx === 1 ? 'bg-slate-400 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {idx + 1}
                </span>
                <div>
                  <span className="font-medium text-white">{seller.name}</span>
                  <span className="text-slate-500 ml-2 text-sm">{seller.code}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-green-400 font-medium">{formatCurrency(seller.total_sales)}</span>
                <span className="text-slate-500 ml-2 text-sm">{seller.sales_count} ventas</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const EmployeesTab = () => (
    <div className="space-y-4">
      {!payrollConfigured && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-400/30 text-amber-200 rounded-xl px-4 py-3">
          <div className="text-sm">
            Falta configurar la nómina global. Esto es necesario antes de registrar el primer empleado.
          </div>
          <button
            onClick={() => {
              setActiveTab('payroll');
              openPayrollWizard('auto');
            }}
            className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-lg text-sm"
          >
            Configurar ahora
          </button>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={() => { setEditingEmployee(null); setShowEmployeeModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
          <HiOutlinePlus className="w-5 h-5" />Nuevo Empleado
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Posición</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Salario</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Comisión %</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {employeeList.map(emp => (
              <tr key={emp.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-indigo-400 font-mono">{emp.code}</td>
                <td className="px-4 py-3">
                  <div>
                    <span className="text-white font-medium">{emp.name}</span>
                    {emp.email && <span className="text-slate-500 block text-sm">{emp.email}</span>}
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      emp.payroll_system || emp.payroll_rules || emp.payroll_cycle || emp.payroll_system_custom
                        ? 'bg-indigo-500/20 text-indigo-200'
                        : 'bg-slate-600/20 text-slate-300'
                    }`}>
                      Nómina: {emp.payroll_system || emp.payroll_rules || emp.payroll_cycle || emp.payroll_system_custom ? 'Personalizada' : 'Global'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{emp.position || '-'}</td>
                <td className="px-4 py-3 text-right text-white">{formatCurrency(emp.salary)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{(emp.commission_rate * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {emp.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { setEditingEmployee(emp); setShowEmployeeModal(true); }}
                    className="text-slate-400 hover:text-white p-1"><HiOutlinePencil className="w-5 h-5" /></button>
                </td>
              </tr>
            ))}
            {employeeList.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay empleados registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const InvitesTab = () => (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h3 className="font-semibold text-white">Nueva invitación</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input
            value={inviteDraft.name}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre del trabajador"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <select
            value={inviteDraft.role}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, role: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="cajero">Cajero</option>
            <option value="inventario">Inventario</option>
            <option value="gerente">Gerente</option>
          </select>
          <input
            value={inviteDraft.email}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email (opcional)"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <input
            value={inviteDraft.phone}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Teléfono (opcional)"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
          <select
            value={inviteDraft.status}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, status: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="active">Activo</option>
            <option value="paused">Pausado</option>
          </select>
          <select
            value={inviteDraft.payroll_cycle}
            onChange={(e) => setInviteDraft((prev) => ({ ...prev, payroll_cycle: e.target.value }))}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="semanal">Nómina semanal</option>
            <option value="quincenal">Nómina quincenal</option>
            <option value="mensual">Nómina mensual</option>
          </select>
        </div>
        <button
          onClick={handleCreateInvite}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
        >
          Generar código
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nómina</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Contacto</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">Sin invitaciones</td>
              </tr>
            ) : invites.map((invite) => (
              <tr key={invite.code} className="border-t border-slate-700/50">
                <td className="px-4 py-3 text-slate-200 font-mono text-sm">{invite.code}</td>
                <td className="px-4 py-3 text-slate-200">
                  <input
                    value={invite.name || ''}
                    onChange={(e) => handleUpdateInvite(invite.code, { name: e.target.value })}
                    className="bg-transparent border border-slate-700/60 rounded px-2 py-1 text-sm text-white"
                  />
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <select
                    value={invite.role || 'cajero'}
                    onChange={(e) => handleUpdateInvite(invite.code, { role: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white"
                  >
                    <option value="cajero">Cajero</option>
                    <option value="inventario">Inventario</option>
                    <option value="gerente">Gerente</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-200">
                  <select
                    value={invite.payroll_cycle || 'mensual'}
                    onChange={(e) => handleUpdateInvite(invite.code, { payroll_cycle: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white"
                  >
                    <option value="semanal">Semanal</option>
                    <option value="quincenal">Quincenal</option>
                    <option value="mensual">Mensual</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-slate-300 text-sm">
                  <input
                    value={invite.email || ''}
                    onChange={(e) => handleUpdateInvite(invite.code, { email: e.target.value })}
                    placeholder="Email"
                    className="mb-1 w-full bg-transparent border border-slate-700/60 rounded px-2 py-1 text-xs text-slate-200"
                  />
                  <input
                    value={invite.phone || ''}
                    onChange={(e) => handleUpdateInvite(invite.code, { phone: e.target.value })}
                    placeholder="Teléfono"
                    className="w-full bg-transparent border border-slate-700/60 rounded px-2 py-1 text-xs text-slate-200"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  <select
                    value={invite.status || 'active'}
                    onChange={(e) => handleUpdateInvite(invite.code, { status: e.target.value })}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white"
                  >
                    <option value="active">Activo</option>
                    <option value="paused">Pausado</option>
                    <option value="used">Usado</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleCopyLink(invite.code)}
                      className="text-violet-300 hover:text-violet-200"
                      title="Copiar enlace"
                    >
                      <HiOutlineClipboardCopy className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleRegenerateInvite(invite)}
                      className="text-slate-300 hover:text-white text-xs"
                      title="Regenerar código"
                      disabled={invite.status === 'used'}
                    >
                      Regenerar
                    </button>
                    {invite.email && (
                      <a
                        href={`mailto:${invite.email}?subject=Invitación GENESIS&body=${encodeURIComponent(`Tu código: ${invite.code}\nEnlace: ${window.location.origin}/login?invite=${invite.code}`)}`}
                        className="text-slate-300 hover:text-white text-xs"
                      >
                        Email
                      </a>
                    )}
                    {invite.phone && (
                      <a
                        href={`sms:${invite.phone}?body=${encodeURIComponent(`Tu código GENESIS: ${invite.code}`)}`}
                        className="text-slate-300 hover:text-white text-xs"
                      >
                        SMS
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteInvite(invite.code)}
                      className="text-red-400 hover:text-red-300"
                      title="Eliminar"
                    >
                      <HiOutlineTrash className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700/50">
          <h3 className="text-white font-semibold">Altas en RRHH</h3>
          <p className="text-xs text-slate-400">Registro automático de trabajadores activados.</p>
        </div>
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Usuario</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Rol</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Alta</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estado nómina</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Sin altas registradas</td>
              </tr>
            ) : enrollments.map((enroll) => (
              <tr key={enroll.employee_id} className="border-t border-slate-700/50">
                <td className="px-4 py-3 text-slate-200">{enroll.username}</td>
                <td className="px-4 py-3 text-slate-300">{enroll.role}</td>
                <td className="px-4 py-3 text-slate-400">{new Date(enroll.start_date).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-emerald-400">{enroll.payroll_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const AttendanceConfigPanel = () => (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
      <div>
        <h3 className="text-white font-semibold">Control de asistencia</h3>
        <p className="text-xs text-slate-400">
          Configura los métodos de entrada y salida del personal.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.manual}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, manual: e.target.checked }))}
            className="accent-violet-600"
          />
          Registro manual (supervisor)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.qrCheckIn}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, qrCheckIn: e.target.checked }))}
            className="accent-violet-600"
          />
          Código QR desde el móvil
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.mobileFingerprint}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, mobileFingerprint: e.target.checked }))}
            className="accent-violet-600"
          />
          Huella en móvil
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.mobileFace}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, mobileFace: e.target.checked }))}
            className="accent-violet-600"
          />
          Reconocimiento facial
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.geoFence}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, geoFence: e.target.checked }))}
            className="accent-violet-600"
          />
          Geocerca (ubicación)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.externalFingerprintReader}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, externalFingerprintReader: e.target.checked }))}
            className="accent-violet-600"
          />
          Lector de huella externo
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={attendanceConfig.nfcCheckIn}
            onChange={(e) => setAttendanceConfig(prev => ({ ...prev, nfcCheckIn: e.target.checked }))}
            className="accent-violet-600"
          />
          NFC / tarjeta de proximidad
        </label>
      </div>
      <textarea
        value={attendanceConfig.notes}
        onChange={(e) => setAttendanceConfig(prev => ({ ...prev, notes: e.target.value }))}
        placeholder="Notas de implementación o proveedor de biometría..."
        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm min-h-[80px]"
      />
      <button
        onClick={async () => {
          await db.settings?.put({ key: "attendance_methods", value: JSON.stringify(attendanceConfig) });
        }}
        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
      >
        Guardar configuración
      </button>
    </div>
  );

  const SchedulesTab = () => (
    <div className="space-y-4">
      <AttendanceConfigPanel />
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3 items-center">
          <input type="date" value={scheduleFilter.start_date} onChange={e => setScheduleFilter({ ...scheduleFilter, start_date: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
          <span className="text-slate-500">a</span>
          <input type="date" value={scheduleFilter.end_date} onChange={e => setScheduleFilter({ ...scheduleFilter, end_date: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white" />
        </div>
        <button onClick={() => setShowScheduleModal(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
          <HiOutlinePlus className="w-5 h-5" />Asignar Turno
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Empleado</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Turno</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Horario</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Entrada Real</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Salida Real</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map(sch => (
              <tr key={sch.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-white">{formatDate(sch.date)}</td>
                <td className="px-4 py-3">
                  <span className="text-white">{sch.employee_name}</span>
                  <span className="text-slate-500 ml-2 text-sm">{sch.employee_code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded text-sm" style={{ backgroundColor: sch.color + '30', color: sch.color }}>{sch.shift_name}</span>
                </td>
                <td className="px-4 py-3 text-center text-slate-300 font-mono">{sch.start_time} - {sch.end_time}</td>
                <td className="px-4 py-3 text-center text-green-400 font-mono">{sch.actual_start || '-'}</td>
                <td className="px-4 py-3 text-center text-green-400 font-mono">{sch.actual_end || '-'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(sch.status)}`}>{sch.status}</span>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">No hay horarios en este período</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const CommissionsTab = () => (
    <div className="space-y-4">
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Empleado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Venta</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Tasa</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Comisión</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map(com => (
              <tr key={com.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-300">{formatDate(com.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="text-white">{com.employee_name}</span>
                  <span className="text-slate-500 ml-2 text-sm">{com.employee_code}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(com.sale_total)}</td>
                <td className="px-4 py-3 text-right text-slate-400">{(com.rate * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right text-green-400 font-medium">{formatCurrency(com.amount)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(com.status)}`}>{com.status}</span>
                </td>
              </tr>
            ))}
            {commissions.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No hay comisiones registradas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const PayrollTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Configuración de nómina</h3>
          <p className="text-xs text-slate-400">Define reglas globales o personaliza por empleado.</p>
        </div>
        <button
          onClick={() => openPayrollWizard('auto')}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
        >
          Abrir wizard RRHH
        </button>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h3 className="text-white font-semibold">Sistema de salarios</h3>
        <p className="text-xs text-slate-400">
          Selecciona el sistema de pago. Si es personalizado, describe el formato para mantener consistencia contable.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            value={payrollCycle}
            onChange={(e) => setPayrollCycle(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="semanal">Nómina semanal</option>
            <option value="quincenal">Nómina quincenal</option>
            <option value="mensual">Nómina mensual</option>
          </select>
          <select
            value={payrollSystem}
            onChange={(e) => setPayrollSystem(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="mensual">Salario mensual</option>
            <option value="quincenal">Salario quincenal</option>
            <option value="semanal">Salario semanal</option>
            <option value="hora">Pago por hora</option>
            <option value="mixto">Mixto (base + variables)</option>
            <option value="comision">Solo comisión</option>
            <option value="custom">Otro / personalizado</option>
          </select>
          {payrollSystem === "custom" && (
            <input
              value={payrollSystemCustom}
              onChange={(e) => setPayrollSystemCustom(e.target.value)}
              placeholder="Describe el sistema y su periodicidad"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          )}
        </div>
        <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-sm text-slate-300 font-semibold">Reglas de pago variable</p>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={payrollRules.hourly}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, hourly: e.target.checked }))}
              className="accent-violet-600"
            />
            Pago por horas
          </label>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="number"
              value={payrollRules.overtimeMultiplier}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, overtimeMultiplier: Number(e.target.value || 1) }))}
              placeholder="Multiplicador extra"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              type="number"
              value={payrollRules.nightMultiplier}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, nightMultiplier: Number(e.target.value || 1) }))}
              placeholder="Multiplicador nocturno"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              type="number"
              value={payrollRules.weekendMultiplier}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, weekendMultiplier: Number(e.target.value || 1) }))}
              placeholder="Multiplicador fin de semana"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <select
              value={payrollRules.performanceBonus}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, performanceBonus: e.target.value }))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="none">Sin bono</option>
              <option value="sales">Bono por ventas</option>
              <option value="production">Bono por producción</option>
              <option value="profit">Bono por utilidad</option>
            </select>
            <input
              type="number"
              value={payrollRules.profitSharePercent}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, profitSharePercent: Number(e.target.value || 0) }))}
              placeholder="% utilidad (post costos/gastos)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              type="number"
              value={payrollRules.deductionsPercent}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, deductionsPercent: Number(e.target.value || 0) }))}
              placeholder="% deducciones (impuestos/ley)"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              type="number"
              value={payrollRules.employerContributionPercent}
              onChange={(e) => setPayrollRules(prev => ({ ...prev, employerContributionPercent: Number(e.target.value || 0) }))}
              placeholder="% aporte patronal"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Recomendación: definir periodicidad, base, variables y deducciones para evitar inconsistencias.
        </div>
        <button
          onClick={async () => {
            if (payrollSystem === 'custom' && !payrollSystemCustom.trim()) {
              setPayrollError('Describe el sistema personalizado.');
              return;
            }
            setPayrollError('');
            await db.settings?.put({ key: "payroll_cycle", value: payrollCycle });
            await db.settings?.put({ key: "payroll_system", value: payrollSystem });
            await db.settings?.put({ key: "payroll_system_custom", value: payrollSystemCustom });
            await db.settings?.put({ key: "payroll_rules", value: JSON.stringify(payrollRules) });
            await db.settings?.put({ key: "payroll_configured", value: "true" });
            setPayrollConfigured(true);
          }}
          className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm"
        >
          Guardar sistema
        </button>
        {payrollError && (
          <p className="text-xs text-amber-300">{payrollError}</p>
        )}
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Período</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Empleado</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Salario Base</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Comisiones</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Bonos</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Deducciones</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Aporte patronal</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Total</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
            </tr>
          </thead>
          <tbody>
            {payrolls.map(pay => (
              <tr key={pay.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-300">{formatDate(pay.period_start)} - {formatDate(pay.period_end)}</td>
                <td className="px-4 py-3">
                  <span className="text-white">{pay.employee_name}</span>
                  <span className="text-slate-500 ml-2 text-sm">{pay.employee_code}</span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{formatCurrency(pay.base_salary)}</td>
                <td className="px-4 py-3 text-right text-indigo-400">{formatCurrency(pay.commissions)}</td>
                <td className="px-4 py-3 text-right text-emerald-300">{formatCurrency(pay.bonuses || 0)}</td>
                <td className="px-4 py-3 text-right text-amber-300">{formatCurrency(pay.deductions || 0)}</td>
                <td className="px-4 py-3 text-right text-cyan-300">{formatCurrency(pay.employer_contribution || 0)}</td>
                <td className="px-4 py-3 text-right text-green-400 font-bold">{formatCurrency(pay.total)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(pay.status)}`}>{pay.status}</span>
                </td>
              </tr>
            ))}
            {payrolls.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay nóminas generadas</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==================== MODALS ====================
  const EmployeeModal = () => {
    const parsedEmployeeRules = (() => {
      if (!editingEmployee?.payroll_rules) return null;
      try {
        return JSON.parse(editingEmployee.payroll_rules);
      } catch {
        return null;
      }
    })();
    const hasCustomPayroll = Boolean(editingEmployee?.payroll_system || editingEmployee?.payroll_rules || editingEmployee?.payroll_cycle);
    const [form, setForm] = useState(editingEmployee || {
      name: '',
      email: '',
      phone: '',
      position: '',
      department: '',
      salary: 0,
      commission_rate: 0.05,
      payroll_cycle: payrollCycle,
      payroll_system: payrollSystem,
      payroll_system_custom: payrollSystemCustom,
      payroll_rules: { ...payrollRules },
      useGlobalPayroll: true
    });
    const [payrollModalError, setPayrollModalError] = useState("");
    useEffect(() => {
      if (!editingEmployee) return;
      setForm((prev) => ({
        ...prev,
        payroll_cycle: editingEmployee.payroll_cycle || payrollCycle,
        payroll_system: editingEmployee.payroll_system || payrollSystem,
        payroll_system_custom: editingEmployee.payroll_system_custom || payrollSystemCustom,
        payroll_rules: parsedEmployeeRules ? { ...payrollRules, ...parsedEmployeeRules } : { ...payrollRules },
        useGlobalPayroll: !hasCustomPayroll
      }));
    }, [editingEmployee]);
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        if (!editingEmployee && employeeList.length === 0 && form.useGlobalPayroll && !payrollConfigured) {
          setPayrollModalError("Define nómina global en RRHH o personaliza para este empleado.");
          setSubmitting(false);
          return;
        }
        if (!form.useGlobalPayroll && form.payroll_system === "custom" && !form.payroll_system_custom?.trim()) {
          setPayrollModalError("Describe el sistema salarial personalizado.");
          setSubmitting(false);
          return;
        }
        setPayrollModalError("");
        const payload = {
          ...form,
          payroll_cycle: form.useGlobalPayroll ? null : form.payroll_cycle,
          payroll_system: form.useGlobalPayroll ? null : form.payroll_system,
          payroll_system_custom: form.useGlobalPayroll ? null : form.payroll_system_custom,
          payroll_rules: form.useGlobalPayroll ? null : form.payroll_rules
        };
        if (editingEmployee) {
          await employees.update(editingEmployee.id, payload);
        } else {
          await employees.create(payload);
        }
        setShowEmployeeModal(false);
        loadEmployees();
      } catch (err) { alert('Error: ' + err.message); }
      finally { setSubmitting(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
            <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
                <input type="text" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Posición</label>
                <input type="text" value={form.position || ''} onChange={e => setForm({ ...form, position: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Ej: Cajero, Operaciones" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Departamento</label>
                <input type="text" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="Ej: Ventas, Producción" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Salario Mensual</label>
                <input type="number" value={form.salary || 0} onChange={e => setForm({ ...form, salary: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" min="0" step="100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tasa de Comisión</label>
                <div className="relative">
                  <input type="number" value={(form.commission_rate || 0) * 100} onChange={e => setForm({ ...form, commission_rate: (parseFloat(e.target.value) || 0) / 100 })}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white pr-8" min="0" max="100" step="0.5" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">%</span>
                </div>
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300 font-medium">Pago y nómina</span>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={form.useGlobalPayroll}
                    onChange={(e) => setForm({ ...form, useGlobalPayroll: e.target.checked })}
                    className="accent-violet-600"
                  />
                  Usar configuración global
                </label>
              </div>
              {!form.useGlobalPayroll && (
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={form.payroll_cycle || 'mensual'}
                    onChange={(e) => setForm({ ...form, payroll_cycle: e.target.value })}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="semanal">Nómina semanal</option>
                    <option value="quincenal">Nómina quincenal</option>
                    <option value="mensual">Nómina mensual</option>
                  </select>
                  <select
                    value={form.payroll_system || 'mensual'}
                    onChange={(e) => setForm({ ...form, payroll_system: e.target.value })}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="mensual">Salario mensual</option>
                    <option value="quincenal">Salario quincenal</option>
                    <option value="semanal">Salario semanal</option>
                    <option value="hora">Pago por hora</option>
                    <option value="mixto">Mixto (base + variables)</option>
                    <option value="comision">Solo comisión</option>
                    <option value="custom">Otro / personalizado</option>
                  </select>
                  {form.payroll_system === "custom" && (
                    <input
                      value={form.payroll_system_custom || ""}
                      onChange={(e) => setForm({ ...form, payroll_system_custom: e.target.value })}
                      placeholder="Describe el sistema y su periodicidad"
                      className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm md:col-span-2"
                    />
                  )}
                  <div className="md:col-span-2 bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-slate-400">Reglas de pago variable</p>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={form.payroll_rules?.hourly || false}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, hourly: e.target.checked }
                        })}
                        className="accent-violet-600"
                      />
                      Pago por horas
                    </label>
                    <div className="grid gap-2 md:grid-cols-3">
                      <input
                        type="number"
                        value={form.payroll_rules?.overtimeMultiplier ?? 1}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, overtimeMultiplier: Number(e.target.value || 1) }
                        })}
                        placeholder="Multiplicador extra"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                      <input
                        type="number"
                        value={form.payroll_rules?.nightMultiplier ?? 1}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, nightMultiplier: Number(e.target.value || 1) }
                        })}
                        placeholder="Multiplicador nocturno"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                      <input
                        type="number"
                        value={form.payroll_rules?.weekendMultiplier ?? 1}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, weekendMultiplier: Number(e.target.value || 1) }
                        })}
                        placeholder="Multiplicador fin de semana"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <select
                        value={form.payroll_rules?.performanceBonus || "none"}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, performanceBonus: e.target.value }
                        })}
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      >
                        <option value="none">Sin bono</option>
                        <option value="sales">Bono por ventas</option>
                        <option value="production">Bono por producción</option>
                        <option value="profit">Bono por utilidad</option>
                      </select>
                      <input
                        type="number"
                        value={form.payroll_rules?.profitSharePercent ?? 0}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, profitSharePercent: Number(e.target.value || 0) }
                        })}
                        placeholder="% utilidad (post costos/gastos)"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                      <input
                        type="number"
                        value={form.payroll_rules?.deductionsPercent ?? 0}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, deductionsPercent: Number(e.target.value || 0) }
                        })}
                        placeholder="% deducciones (impuestos/ley)"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                      <input
                        type="number"
                        value={form.payroll_rules?.employerContributionPercent ?? 0}
                        onChange={(e) => setForm({
                          ...form,
                          payroll_rules: { ...form.payroll_rules, employerContributionPercent: Number(e.target.value || 0) }
                        })}
                        placeholder="% aporte patronal"
                        className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
              {form.useGlobalPayroll && (
                <p className="text-xs text-slate-500">
                  Este empleado usará las reglas globales configuradas en RRHH.
                </p>
              )}
            </div>
            {payrollModalError && (
              <div className="flex items-center justify-between gap-3 text-xs text-amber-300">
                <span>{payrollModalError}</span>
                {!editingEmployee && employeeList.length === 0 && !payrollConfigured && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmployeeModal(false);
                      setActiveTab('payroll');
                      openPayrollWizard('auto');
                    }}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 rounded-lg"
                  >
                    Configurar nómina
                  </button>
                )}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowEmployeeModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg disabled:opacity-50">{submitting ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ScheduleModal = () => {
    const [form, setForm] = useState({ employee_id: '', shift_id: '', date: new Date().toISOString().split('T')[0] });
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await employees.assignShift(form);
        setShowScheduleModal(false);
        loadSchedules();
        loadData();
      } catch (err) { alert('Error: ' + err.message); }
      finally { setSubmitting(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Asignar Turno</h3>
            <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Empleado *</label>
              <select value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required>
                <option value="">Seleccionar...</option>
                {employeeList.filter(e => e.active).map(emp => <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Turno *</label>
              <select value={form.shift_id} onChange={e => setForm({ ...form, shift_id: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required>
                <option value="">Seleccionar...</option>
                {shifts.map(sh => <option key={sh.id} value={sh.id}>{sh.name} ({sh.start_time} - {sh.end_time})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Fecha *</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowScheduleModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50">{submitting ? 'Guardando...' : 'Asignar'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const PayrollWizardModal = () => {
    const [saving, setSaving] = useState(false);
    const canProceed = wizardScope === 'global' || wizardEmployeeId;
    const handleSave = async () => {
      setSaving(true);
      try {
        if (wizardScope === 'global') {
          if (wizardPayrollSystem === 'custom' && !wizardPayrollSystemCustom.trim()) {
            setPayrollError('Describe el sistema personalizado.');
            setSaving(false);
            return;
          }
          await db.settings?.put({ key: "payroll_cycle", value: wizardPayrollCycle });
          await db.settings?.put({ key: "payroll_system", value: wizardPayrollSystem });
          await db.settings?.put({ key: "payroll_system_custom", value: wizardPayrollSystemCustom });
          await db.settings?.put({ key: "payroll_rules", value: JSON.stringify(wizardPayrollRules) });
          await db.settings?.put({ key: "payroll_configured", value: "true" });
          setPayrollCycle(wizardPayrollCycle);
          setPayrollSystem(wizardPayrollSystem);
          setPayrollSystemCustom(wizardPayrollSystemCustom);
          setPayrollRules({ ...wizardPayrollRules });
          setPayrollConfigured(true);
        } else {
          const payload = {
            payroll_cycle: wizardUseGlobal ? null : wizardPayrollCycle,
            payroll_system: wizardUseGlobal ? null : wizardPayrollSystem,
            payroll_system_custom: wizardUseGlobal ? null : wizardPayrollSystemCustom,
            payroll_rules: wizardUseGlobal ? null : wizardPayrollRules
          };
          await employees.update(wizardEmployeeId, payload);
          await loadEmployees();
        }
        setShowPayrollWizard(false);
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        setSaving(false);
      }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Wizard RRHH</h3>
            <button onClick={() => setShowPayrollWizard(false)} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <div className="p-4 space-y-4">
            {wizardStep === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">¿Cómo deseas configurar pagos y nómina?</p>
                <div className="grid md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setWizardScope('global')}
                    className={`border rounded-xl p-4 text-left ${wizardScope === 'global' ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/30'}`}
                  >
                    <p className="text-white font-medium">Para todo el equipo</p>
                    <p className="text-xs text-slate-400">Aplica una configuración global a todos.</p>
                  </button>
                  <button
                    onClick={() => setWizardScope('employee')}
                    className={`border rounded-xl p-4 text-left ${wizardScope === 'employee' ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/30'}`}
                  >
                    <p className="text-white font-medium">Por trabajador</p>
                    <p className="text-xs text-slate-400">Configura salarios y reglas por empleado.</p>
                  </button>
                </div>
              </div>
            )}
            {wizardStep === 1 && wizardScope === 'employee' && (
              <div className="space-y-3">
                <label className="text-sm text-slate-300">Empleado</label>
                <select
                  value={wizardEmployeeId}
                  onChange={(e) => handleWizardEmployeeChange(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Seleccionar...</option>
                  {employeeList.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.code})</option>
                  ))}
                </select>
                {wizardEmployeeId && (
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      checked={wizardUseGlobal}
                      onChange={(e) => setWizardUseGlobal(e.target.checked)}
                      className="accent-violet-600"
                    />
                    Usar configuración global de RRHH
                  </label>
                )}
              </div>
            )}
            {wizardStep === 1 && wizardScope === 'global' && (
              <div className="space-y-3">
                <p className="text-xs text-slate-400">Aplica para todos los empleados que no tengan reglas personalizadas.</p>
              </div>
            )}
            {wizardStep === 1 && (wizardScope === 'global' || (wizardScope === 'employee' && !wizardUseGlobal && wizardEmployeeId)) && (
              <div className="space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={wizardPayrollCycle}
                    onChange={(e) => setWizardPayrollCycle(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="semanal">Nómina semanal</option>
                    <option value="quincenal">Nómina quincenal</option>
                    <option value="mensual">Nómina mensual</option>
                  </select>
                  <select
                    value={wizardPayrollSystem}
                    onChange={(e) => setWizardPayrollSystem(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="mensual">Salario mensual</option>
                    <option value="quincenal">Salario quincenal</option>
                    <option value="semanal">Salario semanal</option>
                    <option value="hora">Pago por hora</option>
                    <option value="mixto">Mixto (base + variables)</option>
                    <option value="comision">Solo comisión</option>
                    <option value="custom">Otro / personalizado</option>
                  </select>
                  {wizardPayrollSystem === "custom" && (
                    <input
                      value={wizardPayrollSystemCustom}
                      onChange={(e) => setWizardPayrollSystemCustom(e.target.value)}
                      placeholder="Describe el sistema y su periodicidad"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm md:col-span-2"
                    />
                  )}
                </div>
                <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-3 space-y-2">
                  <p className="text-xs text-slate-400">Reglas de pago variable</p>
                  <label className="flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={wizardPayrollRules.hourly}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, hourly: e.target.checked }))}
                      className="accent-violet-600"
                    />
                    Pago por horas
                  </label>
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      value={wizardPayrollRules.overtimeMultiplier}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, overtimeMultiplier: Number(e.target.value || 1) }))}
                      placeholder="Multiplicador extra"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                    <input
                      type="number"
                      value={wizardPayrollRules.nightMultiplier}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, nightMultiplier: Number(e.target.value || 1) }))}
                      placeholder="Multiplicador nocturno"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                    <input
                      type="number"
                      value={wizardPayrollRules.weekendMultiplier}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, weekendMultiplier: Number(e.target.value || 1) }))}
                      placeholder="Multiplicador fin de semana"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <select
                      value={wizardPayrollRules.performanceBonus}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, performanceBonus: e.target.value }))}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    >
                      <option value="none">Sin bono</option>
                      <option value="sales">Bono por ventas</option>
                      <option value="production">Bono por producción</option>
                      <option value="profit">Bono por utilidad</option>
                    </select>
                    <input
                      type="number"
                      value={wizardPayrollRules.profitSharePercent}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, profitSharePercent: Number(e.target.value || 0) }))}
                      placeholder="% utilidad (post costos/gastos)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                    <input
                      type="number"
                      value={wizardPayrollRules.deductionsPercent}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, deductionsPercent: Number(e.target.value || 0) }))}
                      placeholder="% deducciones (impuestos/ley)"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                    <input
                      type="number"
                      value={wizardPayrollRules.employerContributionPercent}
                      onChange={(e) => setWizardPayrollRules(prev => ({ ...prev, employerContributionPercent: Number(e.target.value || 0) }))}
                      placeholder="% aporte patronal"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between p-4 border-t border-slate-700">
            <button
              onClick={() => setShowPayrollWizard(false)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
            >
              Cancelar
            </button>
            <div className="flex items-center gap-2">
              {wizardStep > 0 && (
                <button
                  onClick={() => setWizardStep((prev) => Math.max(prev - 1, 0))}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm"
                >
                  Atrás
                </button>
              )}
              {wizardStep === 0 && (
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm"
                >
                  Continuar
                </button>
              )}
              {wizardStep === 1 && (
                <button
                  disabled={!canProceed || saving}
                  onClick={handleSave}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ==================== RENDER ====================
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.employees", "Recursos Humanos")}</h1>
          <p className="text-slate-400">Gestión de empleados, horarios, comisiones y nómina</p>
        </div>
        <button type="button" onClick={loadData} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <HiOutlineRefresh className="w-5 h-5" />Actualizar
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            <tab.icon className="w-5 h-5" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'employees' && <EmployeesTab />}
      {activeTab === 'invites' && <InvitesTab />}
      {activeTab === 'schedules' && <SchedulesTab />}
      {activeTab === 'commissions' && <CommissionsTab />}
      {activeTab === 'payroll' && <PayrollTab />}

      {showEmployeeModal && <EmployeeModal />}
      {showScheduleModal && <ScheduleModal />}
      {showPayrollWizard && <PayrollWizardModal />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = { blue: 'bg-blue-500/20 text-blue-400', green: 'bg-green-500/20 text-green-400', yellow: 'bg-yellow-500/20 text-yellow-400', purple: 'bg-purple-500/20 text-purple-400' };
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}><Icon className="w-5 h-5" /></div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
