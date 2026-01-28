/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - EXPENSES MODULE v2.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Expense Management with Evidence Capture
 * Features: Evidence Capture, Audit Trail
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ExpensesDB, logAudit } from '../services/dataService';
import { formatCurrency } from '../config/businessConfig';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import EvidenceCapture from '../components/Evidence/EvidenceCapture';
// import aiVision from '../core/AIVision'; // ⭐ IA desactivada por ahora
import toast from 'react-hot-toast';
import { t } from "../i18n";
import {
  HiOutlinePlus,
  HiOutlineSparkles,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineCamera,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineRefresh,
  HiOutlineDocumentText,
  HiOutlineCurrencyDollar,
  HiOutlineCalendar,
  HiOutlineTag,
} from 'react-icons/hi';

// ══════════════════════════════════════════════════════════════════════════════
// EXPENSE CATEGORIES
// ══════════════════════════════════════════════════════════════════════════════

const EXPENSE_CATEGORIES = [
  { id: 'alimentos', name: 'Alimentos/Insumos', icon: '🍞' },
  { id: 'servicios', name: 'Servicios Públicos', icon: '💡' },
  { id: 'alquiler', name: 'Alquiler', icon: '🏠' },
  { id: 'salarios', name: 'Salarios', icon: '👥' },
  { id: 'suministros', name: 'Suministros', icon: '📦' },
  { id: 'mantenimiento', name: 'Mantenimiento', icon: '🔧' },
  { id: 'transporte', name: 'Transporte', icon: '🚗' },
  { id: 'publicidad', name: 'Publicidad', icon: '📢' },
  { id: 'equipos', name: 'Equipos', icon: '🖥️' },
  { id: 'otros', name: 'Otros', icon: '📋' },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Expenses() {
  const [showModal, setShowModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [evidences, setEvidences] = useState([]);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    vendor: '',
    description: '',
    amount: '',
    tax: '',
    payment_method: 'efectivo'
  });

  // Load expenses
  const expenses = useLiveQuery(async () => {
    return await db.expenses
      ?.orderBy('date')
      .reverse()
      .filter(e => !e.deleted_at)
      .limit(100)
      .toArray() || [];
  }, []) || [];

  // Stats
  const stats = useLiveQuery(async () => {
    const all = await db.expenses?.filter(e => !e.deleted_at).toArray() || [];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthExpenses = all.filter(e => e.date?.startsWith(thisMonth));
    
    return {
      totalMonth: monthExpenses.reduce((sum, e) => sum + (e.total || e.amount || 0), 0),
      countMonth: monthExpenses.length,
      pending: all.filter(e => e.status === 'pending').length
    };
  }, []) || { totalMonth: 0, countMonth: 0, pending: 0 };

  // ════════════════════════════════════════════════════════════════════════════
  // EVIDENCE HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  const handleEvidenceChange = async (newEvidences) => {
    setEvidences(newEvidences);
    // ⭐ IA desactivada por ahora
  };

  // ════════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  const resetForm = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      category: '',
      vendor: '',
      description: '',
      amount: '',
      tax: '',
      payment_method: 'efectivo'
    });
    setEvidences([]);
    setSelectedExpense(null);
  };

  const openNewExpense = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.amount || parseFloat(form.amount) <= 0) {
      toast.error('Ingresa un monto válido');
      return;
    }

    setIsProcessing(true);

    try {
      const amount = parseFloat(form.amount) || 0;
      const tax = parseFloat(form.tax) || 0;
      const total = amount + tax;
      const thresholdSetting = await db.settings?.get("expense_evidence_threshold");
      const evidenceThreshold = thresholdSetting?.value ? Number(thresholdSetting.value) : 5000;
      if (total >= evidenceThreshold && evidences.length === 0) {
        sentinelService.addAlert(
          ALERT_TYPES.EXPENSE_MISSING_RECEIPT,
          'Gasto sin comprobante requerido',
          {
            reference_type: 'expense',
            reference_id: form.vendor || 'sin_proveedor',
            total,
            threshold: evidenceThreshold,
            evidence_required: true
          }
        );
        toast.error('Se requiere comprobante para este gasto');
        return;
      }

      const expenseData = {
        ...form,
        amount,
        tax,
        total,
        evidences: evidences
      };

      await ExpensesDB.create(expenseData);

      toast.success('Gasto registrado con evidencias');
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Error al guardar');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    
    await ExpensesDB.softDelete(id);
    toast.success('Gasto eliminado');
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.expenses", "Gastos")}</h1>
          <p className="text-slate-400">Registro con evidencias fotográficas</p>
        </div>
        <button
          onClick={openNewExpense}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Nuevo Gasto
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <HiOutlineCurrencyDollar className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Gastos del Mes</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(stats.totalMonth)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <HiOutlineDocumentText className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Registros este Mes</p>
              <p className="text-2xl font-bold text-white">{stats.countMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <HiOutlineDocumentText className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Pendientes Aprobar</p>
              <p className="text-2xl font-bold text-white">{stats.pending}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Expenses List */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden min-h-[520px]">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white">Historial de Gastos</h3>
        </div>

        {expenses.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <HiOutlineDocumentText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No hay gastos registrados</p>
            <button onClick={openNewExpense} className="mt-4 text-red-400 hover:text-red-300">
              Registrar primer gasto
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-700 max-h-[calc(100vh-24rem)] overflow-y-auto">
            {expenses.map(expense => (
              <div key={expense.id} className="p-4 hover:bg-slate-700/30 flex items-center gap-4">
                {/* Category Icon */}
                <div className="w-12 h-12 bg-slate-700 rounded-xl flex items-center justify-center text-2xl">
                  {EXPENSE_CATEGORIES.find(c => c.id === expense.category)?.icon || '📋'}
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{expense.vendor || 'Sin proveedor'}</span>
                    {expense.evidences && expense.evidences.length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded flex items-center gap-1">
                        <HiOutlineCamera className="w-3 h-3" /> {expense.evidences.length}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{expense.description || expense.category}</p>
                  <p className="text-xs text-slate-500">{expense.date}</p>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <p className="font-bold text-red-400">{formatCurrency(expense.total || expense.amount)}</p>
                  <p className="text-xs text-slate-500">{expense.payment_method}</p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400"
                  >
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineDocumentText className="w-5 h-5 text-red-400" />
                Nuevo Gasto
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Evidence Capture */}
              <EvidenceCapture
                context="expense"
                transactionId={selectedExpense?.id || 'NEW'}
                required={false}
                onChange={handleEvidenceChange}
                existingEvidences={evidences}
              />

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">Categoría</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                  >
                    <option value="">Seleccionar...</option>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Proveedor/Comercio</label>
                <input
                  type="text"
                  value={form.vendor}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="Nombre del proveedor"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Descripción del gasto"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Monto (sin impuesto)</label>
                  <input
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-slate-400 mb-1">ITBIS/Impuesto</label>
                  <input
                    type="number"
                    value={form.tax}
                    onChange={(e) => setForm({ ...form, tax: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Método de Pago</label>
                <div className="grid grid-cols-3 gap-2">
                  {['efectivo', 'tarjeta', 'transferencia'].map(method => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setForm({ ...form, payment_method: method })}
                      className={`py-2 rounded-lg border-2 transition-colors ${
                        form.payment_method === method
                          ? 'border-red-500 bg-red-500/20 text-red-400'
                          : 'border-slate-600 text-slate-400'
                      }`}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Preview */}
              {form.amount && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex justify-between text-lg">
                    <span className="text-slate-400">Total:</span>
                    <span className="font-bold text-red-400">
                      {formatCurrency((parseFloat(form.amount) || 0) + (parseFloat(form.tax) || 0))}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); resetForm(); }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <HiOutlineRefresh className="w-5 h-5 animate-spin" />
                  ) : (
                    <HiOutlineCheck className="w-5 h-5" />
                  )}
                  Guardar Gasto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}