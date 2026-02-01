/**
 * GENESIS - Contabilidad Avanzada
 * Conectado a Dexie.js con useLiveQuery
 * CRUD real, ROI real, Gráficos reales
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, AccountsDB, JournalDB, InvestmentDB, TransactionsDB } from '../services/dataService';
import { formatCurrency } from '../config/businessConfig';
import { t } from "../i18n";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineChartBar,
  HiOutlineCash,
  HiOutlineDocumentText,
  HiOutlineLightBulb,
  HiOutlineCalculator,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineTrendingUp,
  HiOutlineCurrencyDollar,
  HiOutlineClipboardList
} from 'react-icons/hi';

// Colores para gráficos
const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

// Tipos de cuenta con etiquetas
const ACCOUNT_TYPES = {
  activo_circulante: { label: 'Activo Circulante', color: 'bg-blue-500' },
  activo_fijo: { label: 'Activo Fijo', color: 'bg-blue-700' },
  pasivo_corto: { label: 'Pasivo Corto Plazo', color: 'bg-red-500' },
  pasivo_largo: { label: 'Pasivo Largo Plazo', color: 'bg-red-700' },
  capital: { label: 'Capital', color: 'bg-purple-500' },
  ingresos: { label: 'Ingresos', color: 'bg-green-500' },
  costos: { label: 'Costos', color: 'bg-yellow-500' },
  gastos: { label: 'Gastos', color: 'bg-orange-500' }
};

export default function AccountingAdvanced() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showInvestmentModal, setShowInvestmentModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // ==================== DATOS EN VIVO DE DEXIE ====================
  
  // Cuentas contables
  const accounts = useLiveQuery(() => db.accounts.where('active').equals(1).toArray(), []) || [];
  
  // Asientos contables
  const journalEntries = useLiveQuery(async () => {
    if (!db.journalEntries) return [];
    let entries = [];
    try {
      entries = await db.journalEntries.orderBy('created_at').reverse().limit(50).toArray();
    } catch (err) {
      const fallback = await db.journalEntries.toArray();
      fallback.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      entries = fallback.slice(0, 50);
    }
    for (const entry of entries) {
      entry.lines = await db.journalLines?.where('entry_id').equals(entry.id).toArray() || [];
    }
    return entries;
  }, []) || [];
  
  // Configuración de inversión
  const investmentConfig = useLiveQuery(() => db.investmentConfig.get(1), []);
  
  // Amortizaciones
  const amortizations = useLiveQuery(() => 
    db.investmentAmortizations.orderBy('created_at').reverse().limit(20).toArray(), 
  []) || [];
  
  // Datos para gráficos - Ingresos vs Gastos por mes
  const [chartData, setChartData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);
  
  // Cargar datos de gráficos
  useEffect(() => {
    loadChartData();
  }, [accounts]);
  
  const loadChartData = async () => {
    try {
      const monthly = await TransactionsDB.getMonthlyTotals(6);
      setChartData(monthly);
      
      const expenses = await TransactionsDB.getExpensesByCategory();
      setExpenseData(expenses);
    } catch (err) {
      console.error('Error loading chart data:', err);
    }
  };

  // Inicializar cuentas si no existen
  useEffect(() => {
    AccountsDB.initialize();
  }, []);
  
  // ==================== CÁLCULOS ====================
  
  // Balance general
  const balanceSheet = {
    activos: accounts.filter(a => a.type?.startsWith('activo')).reduce((sum, a) => sum + (a.balance || 0), 0),
    pasivos: accounts.filter(a => a.type?.startsWith('pasivo')).reduce((sum, a) => sum + (a.balance || 0), 0),
    capital: accounts.filter(a => a.type === 'capital').reduce((sum, a) => sum + (a.balance || 0), 0)
  };
  balanceSheet.diferencia = balanceSheet.activos - (balanceSheet.pasivos + balanceSheet.capital);
  balanceSheet.balanced = Math.abs(balanceSheet.diferencia) < 0.01;
  
  // Estado de resultados
  const incomeStatement = {
    ingresos: accounts.filter(a => a.type === 'ingresos').reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
    costos: accounts.filter(a => a.type === 'costos').reduce((sum, a) => sum + Math.abs(a.balance || 0), 0),
    gastos: accounts.filter(a => a.type === 'gastos').reduce((sum, a) => sum + Math.abs(a.balance || 0), 0)
  };
  incomeStatement.utilidadBruta = incomeStatement.ingresos - incomeStatement.costos;
  incomeStatement.utilidadNeta = incomeStatement.utilidadBruta - incomeStatement.gastos;
  
  // Progreso de inversión
  const investmentProgress = investmentConfig ? {
    total: investmentConfig.total_amount || 0,
    recovered: investmentConfig.recovered_amount || 0,
    remaining: (investmentConfig.total_amount || 0) - (investmentConfig.recovered_amount || 0),
    percentage: investmentConfig.total_amount > 0 
      ? Math.min(((investmentConfig.recovered_amount || 0) / investmentConfig.total_amount) * 100, 100)
      : 0
  } : null;

  // ==================== HANDLERS ====================
  
  const handleSaveAccount = async (accountData) => {
    setLoading(true);
    try {
      if (editingAccount) {
        await AccountsDB.update(editingAccount.id, accountData);
        toast.success('Cuenta actualizada');
      } else {
        await AccountsDB.create(accountData);
        toast.success('Cuenta creada');
      }
      setShowAccountModal(false);
      setEditingAccount(null);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleDeleteAccount = async (account) => {
    if (!confirm(`¿Eliminar cuenta "${account.name}"?`)) return;
    
    try {
      await AccountsDB.delete(account.id);
      toast.success('Cuenta eliminada');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSaveEntry = async (entryData) => {
    setLoading(true);
    try {
      const result = await JournalDB.create(entryData);
      toast.success(`Asiento #${result.entry_number} creado`);
      setShowEntryModal(false);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleSaveInvestment = async (investmentData) => {
    setLoading(true);
    try {
      await InvestmentDB.saveConfig(investmentData);
      toast.success('Inversión configurada');
      setShowInvestmentModal(false);
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleRecordAmortization = async (amount, source = 'manual') => {
    try {
      const result = await InvestmentDB.recordAmortization(amount, source);
      toast.success(`Amortización de ${formatCurrency(result.amount)} registrada`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ==================== TABS ====================
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartBar },
    { id: 'accounts', label: 'Plan de Cuentas', icon: HiOutlineClipboardList },
    { id: 'journal', label: 'Libro Diario', icon: HiOutlineDocumentText },
    { id: 'investment', label: 'Inversión ROI', icon: HiOutlineTrendingUp },
    { id: 'assistant', label: 'Asistente IA', icon: HiOutlineLightBulb }
  ];

  // ==================== RENDER ====================
  
  return (
    <div className="space-y-6 min-h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.accountingPro", "Contabilidad Avanzada")}</h1>
          <p className="text-slate-400">Gestión contable completa con datos en tiempo real</p>
        </div>
        <button
          type="button"
          onClick={loadChartData}
          className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg"
        >
          <HiOutlineRefresh className="w-5 h-5" />
          Actualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB: DASHBOARD ==================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Ecuación Contable */}
          <div className={`p-4 rounded-xl border ${balanceSheet.balanced ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-white">Ecuación Contable</h3>
              <span className={`px-3 py-1 rounded-full text-sm ${balanceSheet.balanced ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                {balanceSheet.balanced ? '✓ Cuadra' : '✗ Descuadre'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-4 text-lg">
              <div className="text-center">
                <p className="text-xs text-slate-400">Activos</p>
                <p className="text-xl font-bold text-blue-400">{formatCurrency(balanceSheet.activos)}</p>
              </div>
              <span className="text-slate-500">=</span>
              <div className="text-center">
                <p className="text-xs text-slate-400">Pasivos</p>
                <p className="text-xl font-bold text-red-400">{formatCurrency(balanceSheet.pasivos)}</p>
              </div>
              <span className="text-slate-500">+</span>
              <div className="text-center">
                <p className="text-xs text-slate-400">Capital</p>
                <p className="text-xl font-bold text-purple-400">{formatCurrency(balanceSheet.capital)}</p>
              </div>
            </div>
          </div>

          {/* Gráficos */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Ingresos vs Gastos */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-medium text-white mb-4">Ingresos vs Gastos (6 meses)</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={v => formatCurrency(v)} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                      formatter={(value) => formatCurrency(value)}
                    />
                    <Area type="monotone" dataKey="ingresos" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Ingresos" />
                    <Area type="monotone" dataKey="gastos" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Gastos" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400">
                  Sin datos de transacciones
                </div>
              )}
            </div>

            {/* Distribución de Gastos */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <h3 className="font-medium text-white mb-4">Distribución de Gastos</h3>
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={expenseData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                    >
                      {expenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-slate-400">
                  Sin gastos registrados
                </div>
              )}
            </div>
          </div>

          {/* Progreso de Inversión */}
          {investmentProgress && (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-white">Recuperación de Inversión</h3>
                <span className="text-sm text-slate-400">
                  {investmentProgress.percentage.toFixed(1)}% completado
                </span>
              </div>
              
              <div className="h-4 bg-slate-700 rounded-full overflow-hidden mb-4">
                <div 
                  className={`h-full transition-all duration-500 ${
                    investmentProgress.percentage >= 100 ? 'bg-green-500' :
                    investmentProgress.percentage >= 75 ? 'bg-blue-500' :
                    investmentProgress.percentage >= 50 ? 'bg-purple-500' :
                    investmentProgress.percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${investmentProgress.percentage}%` }}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-400">Total Inversión</p>
                  <p className="font-bold text-white">{formatCurrency(investmentProgress.total)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Recuperado</p>
                  <p className="font-bold text-green-400">{formatCurrency(investmentProgress.recovered)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Pendiente</p>
                  <p className="font-bold text-yellow-400">{formatCurrency(investmentProgress.remaining)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: PLAN DE CUENTAS ==================== */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400">{accounts.length} cuentas activas</p>
            <button
              onClick={() => { setEditingAccount(null); setShowAccountModal(true); }}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              <HiOutlinePlus className="w-5 h-5" />
              Nueva Cuenta
            </button>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Código</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Saldo</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {accounts.map(account => (
                  <tr key={account.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white font-mono">{account.code}</td>
                    <td className="px-4 py-3 text-white">
                      {account.name}
                      {account.system && <span className="ml-2 text-xs text-purple-400">(Sistema)</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${ACCOUNT_TYPES[account.type]?.color || 'bg-slate-600'} text-white`}>
                        {ACCOUNT_TYPES[account.type]?.label || account.type}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${account.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(account.balance)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditingAccount(account); setShowAccountModal(true); }}
                          disabled={account.system}
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account)}
                          disabled={account.system || Math.abs(account.balance) > 0}
                          className="p-1 text-slate-400 hover:text-red-400 disabled:opacity-30"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== TAB: LIBRO DIARIO ==================== */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-slate-400">{journalEntries.length} asientos</p>
            <button
              onClick={() => setShowEntryModal(true)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
            >
              <HiOutlinePlus className="w-5 h-5" />
              Nuevo Asiento
            </button>
          </div>

          <div className="space-y-4">
            {journalEntries.map(entry => (
              <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                <div className="p-4 bg-slate-700/30 flex items-center justify-between">
                  <div>
                    <span className="text-purple-400 font-mono">#{entry.entry_number}</span>
                    <span className="text-slate-400 ml-4">{entry.date}</span>
                  </div>
                  <span className="text-white">{entry.description}</span>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-700/20">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-slate-400">Cuenta</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-400">Debe</th>
                      <th className="px-4 py-2 text-right text-xs text-slate-400">Haber</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entry.lines?.map((line, idx) => (
                      <tr key={idx} className="border-t border-slate-700/50">
                        <td className="px-4 py-2 text-sm text-slate-300">
                          <span className="font-mono text-slate-500 mr-2">{line.account_code}</span>
                          {line.description || accounts.find(a => a.id === line.account_id)?.name}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-green-400">
                          {line.debit > 0 && formatCurrency(line.debit)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-red-400">
                          {line.credit > 0 && formatCurrency(line.credit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            
            {journalEntries.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                No hay asientos contables registrados
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: INVERSIÓN ROI ==================== */}
      {activeTab === 'investment' && (
        <div className="space-y-6">
          {investmentConfig ? (
            <>
              {/* Progreso grande */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="text-center mb-6">
                  <p className="text-4xl font-bold text-white mb-2">
                    {investmentProgress?.percentage.toFixed(1)}%
                  </p>
                  <p className="text-slate-400">de inversión recuperada</p>
                </div>
                
                <div className="h-6 bg-slate-700 rounded-full overflow-hidden mb-6">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      investmentProgress?.percentage >= 100 ? 'bg-gradient-to-r from-green-500 to-emerald-400' :
                      'bg-gradient-to-r from-purple-600 to-indigo-500'
                    }`}
                    style={{ width: `${investmentProgress?.percentage || 0}%` }}
                  />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-slate-700/30 rounded-lg">
                    <p className="text-xs text-slate-400">Inversión Total</p>
                    <p className="text-xl font-bold text-white">{formatCurrency(investmentConfig.total_amount)}</p>
                  </div>
                  <div className="text-center p-4 bg-green-500/10 rounded-lg">
                    <p className="text-xs text-green-400">Recuperado</p>
                    <p className="text-xl font-bold text-green-400">{formatCurrency(investmentConfig.recovered_amount)}</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
                    <p className="text-xs text-yellow-400">Pendiente</p>
                    <p className="text-xl font-bold text-yellow-400">{formatCurrency(investmentProgress?.remaining)}</p>
                  </div>
                  <div className="text-center p-4 bg-purple-500/10 rounded-lg">
                    <p className="text-xs text-purple-400">% de Ventas</p>
                    <p className="text-xl font-bold text-purple-400">{investmentConfig.return_percentage}%</p>
                  </div>
                </div>
              </div>

              {/* Registrar amortización manual */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="font-medium text-white mb-4">Registrar Amortización Manual</h3>
                <AmortizationForm 
                  onSubmit={handleRecordAmortization} 
                  maxAmount={investmentProgress?.remaining || 0}
                />
              </div>

              {/* Historial de amortizaciones */}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h3 className="font-medium text-white mb-4">Historial de Amortizaciones</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {amortizations.map(amort => (
                    <div key={amort.id} className="flex items-center justify-between p-3 bg-slate-700/30 rounded-lg">
                      <div>
                        <p className="text-white text-sm">{formatCurrency(amort.amount)}</p>
                        <p className="text-xs text-slate-400">{amort.source} - {amort.date}</p>
                      </div>
                      <span className="text-green-400">
                        <HiOutlineCheck className="w-5 h-5" />
                      </span>
                    </div>
                  ))}
                  {amortizations.length === 0 && (
                    <p className="text-center text-slate-400 py-4">Sin amortizaciones registradas</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
              <HiOutlineTrendingUp className="w-16 h-16 mx-auto text-purple-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Configura tu Inversión</h3>
              <p className="text-slate-400 mb-6">
                Registra tu inversión inicial y el sistema calculará automáticamente el ROI con cada venta.
              </p>
              <button
                onClick={() => setShowInvestmentModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
              >
                Configurar Inversión
              </button>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: ASISTENTE IA ==================== */}
      {activeTab === 'assistant' && (
        <AIAssistant accounts={accounts} onCreateEntry={handleSaveEntry} />
      )}

      {/* ==================== MODALES ==================== */}
      
      {/* Modal de Cuenta */}
      {showAccountModal && (
        <AccountModal
          account={editingAccount}
          onSave={handleSaveAccount}
          onClose={() => { setShowAccountModal(false); setEditingAccount(null); }}
          loading={loading}
        />
      )}

      {/* Modal de Asiento */}
      {showEntryModal && (
        <EntryModal
          accounts={accounts}
          onSave={handleSaveEntry}
          onClose={() => setShowEntryModal(false)}
          loading={loading}
        />
      )}

      {/* Modal de Inversión */}
      {showInvestmentModal && (
        <InvestmentModal
          config={investmentConfig}
          onSave={handleSaveInvestment}
          onClose={() => setShowInvestmentModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

// ==================== COMPONENTES AUXILIARES ====================

// Formulario de amortización
function AmortizationForm({ onSubmit, maxAmount }) {
  const [amount, setAmount] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (value > 0 && value <= maxAmount) {
      onSubmit(value, 'manual');
      setAmount('');
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="flex gap-4">
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Monto a abonar"
        max={maxAmount}
        step="0.01"
        className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
      />
      <button
        type="submit"
        disabled={!amount || parseFloat(amount) <= 0}
        className="bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg"
      >
        Registrar
      </button>
    </form>
  );
}

// Modal de Cuenta
function AccountModal({ account, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    code: account?.code || '',
    name: account?.name || '',
    type: account?.type || 'activo_circulante',
    nature: account?.nature || 'debit'
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white">{account ? 'Editar Cuenta' : 'Nueva Cuenta'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              {Object.entries(ACCOUNT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Asiento
function EntryModal({ accounts, onSave, onClose, loading }) {
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [lines, setLines] = useState([
    { account_id: '', account_code: '', debit: '', credit: '' },
    { account_id: '', account_code: '', debit: '', credit: '' }
  ]);
  
  const addLine = () => {
    setLines([...lines, { account_id: '', account_code: '', debit: '', credit: '' }]);
  };
  
  const updateLine = (idx, field, value) => {
    const newLines = [...lines];
    newLines[idx][field] = value;
    
    if (field === 'account_id') {
      const account = accounts.find(a => a.id === parseInt(value));
      if (account) {
        newLines[idx].account_code = account.code;
      }
    }
    
    setLines(newLines);
  };
  
  const totalDebit = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isBalanced) return;
    
    onSave({
      description,
      date,
      lines: lines.map(l => ({
        ...l,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0
      })).filter(l => l.account_id && (l.debit > 0 || l.credit > 0))
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white">Nuevo Asiento Contable</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2">
                <select
                  value={line.account_id}
                  onChange={(e) => updateLine(idx, 'account_id', e.target.value)}
                  className="col-span-6 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm"
                >
                  <option value="">Seleccionar cuenta...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={line.debit}
                  onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                  placeholder="Debe"
                  step="0.01"
                  className="col-span-3 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm"
                />
                <input
                  type="number"
                  value={line.credit}
                  onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                  placeholder="Haber"
                  step="0.01"
                  className="col-span-3 bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-white text-sm"
                />
              </div>
            ))}
          </div>
          
          <button type="button" onClick={addLine} className="text-purple-400 hover:text-purple-300 text-sm">
            + Agregar línea
          </button>
          
          <div className={`p-3 rounded-lg ${isBalanced ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Debe: <span className="text-white">{formatCurrency(totalDebit)}</span></span>
              <span className="text-slate-400">Total Haber: <span className="text-white">{formatCurrency(totalCredit)}</span></span>
              <span className={isBalanced ? 'text-green-400' : 'text-red-400'}>
                {isBalanced ? '✓ Balanceado' : '✗ Desbalanceado'}
              </span>
            </div>
          </div>
          
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={loading || !isBalanced} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white py-2 rounded-lg">
              {loading ? 'Guardando...' : 'Crear Asiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal de Inversión
function InvestmentModal({ config, onSave, onClose, loading }) {
  const [form, setForm] = useState({
    total_amount: config?.total_amount || '',
    description: config?.description || '',
    target_date: config?.target_date || '',
    return_percentage: config?.return_percentage || 5,
    profit_percentage: config?.profit_percentage || 10
  });
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      total_amount: parseFloat(form.total_amount)
    });
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white">Configurar Inversión</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Monto Total de Inversión</label>
            <input
              type="number"
              value={form.total_amount}
              onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
              required
              step="0.01"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Descripción</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ej: Capital inicial del negocio"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Fecha Objetivo de Recuperación</label>
            <input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">% de cada Venta</label>
              <input
                type="number"
                value={form.return_percentage}
                onChange={(e) => setForm({ ...form, return_percentage: e.target.value })}
                min="0"
                max="100"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">% de Utilidad</label>
              <input
                type="number"
                value={form.profit_percentage}
                onChange={(e) => setForm({ ...form, profit_percentage: e.target.value })}
                min="0"
                max="100"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Asistente IA
function AIAssistant({ accounts, onCreateEntry }) {
  const [input, setInput] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [processing, setProcessing] = useState(false);
  
  const patterns = [
    { regex: /pag[oué]\s+(de\s+)?(.+?)\s+(\d+\.?\d*)/i, type: 'expense', accountCode: '5203' },
    { regex: /compr[éea]\s+(.+?)\s+(\d+\.?\d*)/i, type: 'expense', accountCode: '5101' },
    { regex: /nómina\s+(\d+\.?\d*)/i, type: 'expense', accountCode: '5201' },
    { regex: /renta\s+(\d+\.?\d*)/i, type: 'expense', accountCode: '5202' },
    { regex: /venta\s+(\d+\.?\d*)/i, type: 'income', accountCode: '4101' },
    { regex: /ingreso\s+(.+?)\s+(\d+\.?\d*)/i, type: 'income', accountCode: '4102' }
  ];
  
  const analyzeText = () => {
    setProcessing(true);
    const text = input.toLowerCase();
    
    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match) {
        const amount = parseFloat(match[match.length - 1]);
        const concept = match.length > 2 ? match[1] || match[2] : 'Concepto';
        
        const expenseAccount = accounts.find(a => a.code === pattern.accountCode);
        const cashAccount = accounts.find(a => a.code === '1101');
        
        if (expenseAccount && cashAccount) {
          setSuggestion({
            description: `${pattern.type === 'expense' ? 'Pago' : 'Ingreso'}: ${concept}`,
            amount,
            lines: pattern.type === 'expense' ? [
              { account_id: expenseAccount.id, account_code: expenseAccount.code, account_name: expenseAccount.name, debit: amount, credit: 0 },
              { account_id: cashAccount.id, account_code: cashAccount.code, account_name: cashAccount.name, debit: 0, credit: amount }
            ] : [
              { account_id: cashAccount.id, account_code: cashAccount.code, account_name: cashAccount.name, debit: amount, credit: 0 },
              { account_id: expenseAccount.id, account_code: expenseAccount.code, account_name: expenseAccount.name, debit: 0, credit: amount }
            ]
          });
          setProcessing(false);
          return;
        }
      }
    }
    
    setSuggestion(null);
    setProcessing(false);
  };
  
  const confirmSuggestion = () => {
    if (suggestion) {
      onCreateEntry({
        description: suggestion.description,
        date: new Date().toISOString().split('T')[0],
        lines: suggestion.lines
      });
      setInput('');
      setSuggestion(null);
    }
  };
  
  const examples = [
    'Pagué luz 500',
    'Compré harina 1200',
    'Nómina 8000',
    'Renta 5000',
    'Venta 1500'
  ];
  
  return (
    <div className="space-y-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <HiOutlineLightBulb className="w-5 h-5 text-yellow-400" />
          Asistente de Asientos Contables
        </h3>
        
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ej: Pagué luz 500"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            onKeyDown={(e) => e.key === 'Enter' && analyzeText()}
          />
          <button
            onClick={analyzeText}
            disabled={!input || processing}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white px-6 py-2 rounded-lg flex items-center gap-2"
          >
            <HiOutlineLightBulb className="w-5 h-5" />
            Analizar
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              onClick={() => setInput(ex)}
              className="text-xs bg-slate-700/50 hover:bg-slate-700 text-slate-300 px-3 py-1 rounded-full"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
      
      {suggestion && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4">
          <h4 className="font-medium text-white mb-4">Asiento Sugerido: {suggestion.description}</h4>
          
          <table className="w-full mb-4">
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="text-left pb-2">Cuenta</th>
                <th className="text-right pb-2">Debe</th>
                <th className="text-right pb-2">Haber</th>
              </tr>
            </thead>
            <tbody>
              {suggestion.lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="text-slate-300 py-1">
                    <span className="font-mono text-slate-500 mr-2">{line.account_code}</span>
                    {line.account_name}
                  </td>
                  <td className="text-right text-green-400 py-1">
                    {line.debit > 0 && formatCurrency(line.debit)}
                  </td>
                  <td className="text-right text-red-400 py-1">
                    {line.credit > 0 && formatCurrency(line.credit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="flex gap-4">
            <button
              onClick={() => setSuggestion(null)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <HiOutlineX className="w-5 h-5" />
              Cancelar
            </button>
            <button
              onClick={confirmSuggestion}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2"
            >
              <HiOutlineCheck className="w-5 h-5" />
              Confirmar y Crear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
