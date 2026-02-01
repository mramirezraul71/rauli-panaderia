/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - CASH DRAWER v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Cash management with Blind Close security
 * Inspired by: Square, Toast, Clover POS
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/dataService';
import cashSession, { SessionStatus, DENOMINATIONS, MovementType } from '../core/CashSession';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate, getBusinessConfig } from '../config/businessConfig';
import { t } from "../i18n";
import EvidenceCapture, { EvidenceContext } from '../components/EvidenceVault';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import {
  HiOutlineCash,
  HiOutlineLockClosed,
  HiOutlineLockOpen,
  HiOutlineArrowUp,
  HiOutlineArrowDown,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineExclamation,
  HiOutlineClipboardList,
  HiOutlineCalculator,
  HiOutlineRefresh,
  HiOutlineEye,
  HiOutlineEyeOff,
  HiOutlineClock,
  HiOutlineDocumentReport,
} from 'react-icons/hi';

// ══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY (evita pantalla en blanco)
// ══════════════════════════════════════════════════════════════════════════════

class CashDrawerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('CashDrawer render error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-800/50 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <HiOutlineExclamation className="w-6 h-6 text-red-400" />
            <h2 className="text-lg font-semibold text-red-400">Error cargando Caja</h2>
          </div>
          <p className="text-slate-300 mb-4">
            Ocurrió un problema al renderizar la pantalla. Puedes recargar para intentar de nuevo.
          </p>
          <button
            onClick={this.handleReload}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
          >
            Recargar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// DENOMINATION COUNTER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function DenominationCounter({ value, onChange }) {
  const [counts, setCounts] = useState({});
  
  useEffect(() => {
    // Calculate total from counts
    let total = 0;
    [...DENOMINATIONS.bills, ...DENOMINATIONS.coins].forEach(d => {
      total += (counts[d.value] || 0) * d.value;
    });
    onChange(total, counts);
  }, [counts]);

  const updateCount = (denomination, delta) => {
    setCounts(prev => ({
      ...prev,
      [denomination]: Math.max(0, (prev[denomination] || 0) + delta)
    }));
  };

  const total = [...DENOMINATIONS.bills, ...DENOMINATIONS.coins].reduce(
    (sum, d) => sum + (counts[d.value] || 0) * d.value, 0
  );

  return (
    <div className="space-y-4">
      {/* Bills */}
      <div>
        <p className="text-slate-400 text-sm mb-2">Billetes</p>
        <div className="grid grid-cols-2 gap-2">
          {DENOMINATIONS.bills.map(bill => (
            <div 
              key={bill.value}
              className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
            >
              <span className="text-white font-medium">{bill.label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCount(bill.value, -1)}
                  className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded text-white"
                >
                  -
                </button>
                <span className="w-8 text-center text-white font-bold">
                  {counts[bill.value] || 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(bill.value, 1)}
                  className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded text-white"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coins */}
      <div>
        <p className="text-slate-400 text-sm mb-2">Monedas</p>
        <div className="grid grid-cols-2 gap-2">
          {DENOMINATIONS.coins.map(coin => (
            <div 
              key={coin.value}
              className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3"
            >
              <span className="text-white font-medium">{coin.label}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateCount(coin.value, -1)}
                  className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded text-white"
                >
                  -
                </button>
                <span className="w-8 text-center text-white font-bold">
                  {counts[coin.value] || 0}
                </span>
                <button
                  type="button"
                  onClick={() => updateCount(coin.value, 1)}
                  className="w-8 h-8 bg-slate-600 hover:bg-slate-500 rounded text-white"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
        <div className="flex justify-between items-center">
          <span className="text-slate-400">Total Contado:</span>
          <span className="text-3xl font-bold text-green-400">
            {formatCurrency(total)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN CASH DRAWER COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function CashDrawerInner() {
  const { user } = useAuth();
  const [currentSession, setCurrentSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  
  // Form states
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState(0);
  const [closingDenomination, setClosingDenomination] = useState(null);
  const [closingNotes, setClosingNotes] = useState('');
  const [cashInOutAmount, setCashInOutAmount] = useState('');
  const [cashInOutDescription, setCashInOutDescription] = useState('');
  const [closingResult, setClosingResult] = useState(null);
  const [closingEvidences, setClosingEvidences] = useState([]);
  
  // Blind close state
  const [isBlindMode, setIsBlindMode] = useState(true);
  const [blindCloseSession, setBlindCloseSession] = useState(null);

  // Load current session
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    setIsLoading(true);
    try {
      const session = await cashSession.getCurrentSession();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Session history
  const sessionHistory = useLiveQuery(async () => {
    const sessions = await db.cashSessions?.toArray() || [];
    return sessions
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 10);
  }, []) || [];

  // ════════════════════════════════════════════════════════════════════════════
  // OPEN DRAWER
  // ════════════════════════════════════════════════════════════════════════════

  const handleOpenDrawer = async () => {
    const amount = parseFloat(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Monto de apertura inválido');
      return;
    }

    try {
      const session = await cashSession.openDrawer(user?.id, amount);
      setCurrentSession(session);
      setShowOpenModal(false);
      setOpeningAmount('');
      toast.success('✓ Caja abierta correctamente');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // BLIND CLOSE - Step 1
  // ════════════════════════════════════════════════════════════════════════════

  const handleStartBlindClose = async () => {
    try {
      const blindSession = await cashSession.startBlindClose(user?.id);
      setBlindCloseSession(blindSession);
      setShowCloseModal(true);
      setIsBlindMode(true);
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // BLIND CLOSE - Step 2 (Submit)
  // ════════════════════════════════════════════════════════════════════════════

  const handleSubmitBlindClose = async () => {
    if (closingAmount <= 0) {
      toast.error('Ingresa el monto contado');
      return;
    }

    try {
      const result = await cashSession.submitBlindClose(
        blindCloseSession.id,
        user?.id,
        closingAmount,
        closingDenomination,
        closingNotes
      );

      setClosingResult(result);
      setShowCloseModal(false);
      setShowResultModal(true);
      setCurrentSession(null);

      let varianceThreshold = 1;
      try {
        const thresholdSetting = await db.settings?.get("cash_variance_threshold");
        if (thresholdSetting?.value) {
          varianceThreshold = Number(thresholdSetting.value) || varianceThreshold;
        }
      } catch {}
      if (Math.abs(result.variance || 0) >= varianceThreshold && closingEvidences.length === 0) {
        sentinelService.addAlert(
          ALERT_TYPES.EVIDENCE_MISSING,
          'Falta evidencia del cierre de caja con varianza',
          {
            reference_type: 'cash_session',
            reference_id: blindCloseSession.id,
            variance: result.variance,
            evidence_required: true
          }
        );
      }
      
      // Reset form
      setClosingAmount(0);
      setClosingDenomination(null);
      setClosingNotes('');
      setClosingEvidences([]);
      setBlindCloseSession(null);

    } catch (error) {
      toast.error(error.message);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CASH IN / OUT
  // ════════════════════════════════════════════════════════════════════════════

  const handleCashIn = async () => {
    const amount = parseFloat(cashInOutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    try {
      await cashSession.cashIn(amount, cashInOutDescription, user?.id);
      await loadSession();
      setShowCashInModal(false);
      setCashInOutAmount('');
      setCashInOutDescription('');
      toast.success('✓ Entrada de efectivo registrada');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCashOut = async () => {
    const amount = parseFloat(cashInOutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    try {
      await cashSession.cashOut(amount, cashInOutDescription, user?.id);
      await loadSession();
      setShowCashOutModal(false);
      setCashInOutAmount('');
      setCashInOutDescription('');
      toast.success('✓ Salida de efectivo registrada');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  const formatTime = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString(getBusinessConfig().dateLocale, {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (isoString) => formatDate(isoString, { day: '2-digit', month: 'short' });

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <HiOutlineRefresh className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
      <div className="space-y-6 min-h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.cash", "Gestión de Caja")}</h1>
          <p className="text-slate-400">Cierre Ciego para seguridad de efectivo</p>
        </div>
      </div>

      {/* Status Banner */}
      {currentSession ? (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-500/20 rounded-full">
              <HiOutlineLockOpen className="w-8 h-8 text-green-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-green-400">Caja Abierta</h2>
              <p className="text-slate-400">
                Desde {formatTime(currentSession.opened_at)} • 
                {currentSession.transaction_count || 0} transacciones
              </p>
            </div>
            <button
              onClick={handleStartBlindClose}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium"
            >
              Cerrar Caja
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-slate-700 rounded-full">
              <HiOutlineLockClosed className="w-8 h-8 text-slate-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">Caja Cerrada</h2>
              <p className="text-slate-400">Abre la caja para comenzar a operar</p>
            </div>
            <button
              onClick={() => setShowOpenModal(true)}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium"
            >
              Abrir Caja
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {currentSession && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setShowCashInModal(true)}
            className="flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700/50"
          >
            <div className="p-3 bg-green-500/20 rounded-xl">
              <HiOutlineArrowDown className="w-6 h-6 text-green-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-white">Entrada de Efectivo</p>
              <p className="text-sm text-slate-400">Agregar dinero a la caja</p>
            </div>
          </button>

          <button
            onClick={() => setShowCashOutModal(true)}
            className="flex items-center gap-4 p-4 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700/50"
          >
            <div className="p-3 bg-red-500/20 rounded-xl">
              <HiOutlineArrowUp className="w-6 h-6 text-red-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-white">Salida de Efectivo</p>
              <p className="text-sm text-slate-400">Retirar dinero de la caja</p>
            </div>
          </button>
        </div>
      )}

      {/* Current Session Stats */}
      {currentSession && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Apertura</p>
            <p className="text-xl font-bold text-white">{formatCurrency(currentSession.opening_amount)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Ventas Efectivo</p>
            <p className="text-xl font-bold text-green-400">{formatCurrency(currentSession.total_sales)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Entradas</p>
            <p className="text-xl font-bold text-blue-400">{formatCurrency(currentSession.total_cash_in)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Salidas</p>
            <p className="text-xl font-bold text-red-400">{formatCurrency(currentSession.total_cash_out)}</p>
          </div>
        </div>
      )}

      {/* Session History */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white flex items-center gap-2">
            <HiOutlineClipboardList className="w-5 h-5" />
            Historial de Cierres
          </h3>
        </div>

        {sessionHistory.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No hay cierres registrados
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {sessionHistory.filter(s => s.status === SessionStatus.CLOSED).map(session => (
              <div key={session.id} className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-full ${
                  session.variance === 0 ? 'bg-green-500/20' :
                  session.variance > 0 ? 'bg-blue-500/20' : 'bg-red-500/20'
                }`}>
                  {session.variance === 0 ? (
                    <HiOutlineCheck className="w-5 h-5 text-green-400" />
                  ) : session.variance > 0 ? (
                    <HiOutlineArrowUp className="w-5 h-5 text-blue-400" />
                  ) : (
                    <HiOutlineArrowDown className="w-5 h-5 text-red-400" />
                  )}
                </div>

                <div className="flex-1">
                  <p className="font-medium text-white">
                    {formatDate(session.closed_at)} - {formatTime(session.closed_at)}
                  </p>
                  <p className="text-sm text-slate-400">
                    {session.transaction_count} transacciones
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-white">{formatCurrency(session.declared_amount)}</p>
                  {session.variance !== 0 && (
                    <p className={`text-sm ${session.variance > 0 ? 'text-blue-400' : 'text-red-400'}`}>
                      {session.variance > 0 ? '+' : ''}{formatCurrency(session.variance)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* OPEN DRAWER MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {showOpenModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineLockOpen className="w-5 h-5 text-green-400" />
                Abrir Caja
              </h3>
              <button onClick={() => setShowOpenModal(false)} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">
                  Monto de Apertura (Fondo de caja)
                </label>
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-xl text-white text-center focus:border-green-500 outline-none"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleOpenDrawer}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                >
                  Abrir Caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* BLIND CLOSE MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineLockClosed className="w-5 h-5 text-red-400" />
                Cierre Ciego de Caja
              </h3>
              <button 
                onClick={() => { setShowCloseModal(false); setBlindCloseSession(null); }} 
                className="text-slate-400 hover:text-white"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Blind Close Warning */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <HiOutlineEyeOff className="w-6 h-6 text-amber-400 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-400">Modo Cierre Ciego</p>
                    <p className="text-sm text-amber-400/80">
                      Cuenta el efectivo ANTES de ver el total esperado. 
                      Esto garantiza la integridad del arqueo.
                    </p>
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="bg-slate-700/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Caja abierta:</span>
                  <span className="text-white">{formatTime(blindCloseSession?.opened_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Transacciones:</span>
                  <span className="text-white">{blindCloseSession?.transaction_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Apertura:</span>
                  <span className="text-white">{formatCurrency(blindCloseSession?.opening_amount)}</span>
                </div>
              </div>

              {/* Denomination Counter */}
              <div>
                <label className="block text-sm text-slate-400 mb-3">
                  Cuenta el efectivo por denominación:
                </label>
                <DenominationCounter
                  value={closingAmount}
                  onChange={(total, counts) => {
                    setClosingAmount(total);
                    setClosingDenomination(counts);
                  }}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas (opcional)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Observaciones del cierre..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none resize-none"
                />
              </div>

              {/* Evidence */}
              <div className="bg-slate-900/60 border border-slate-700 rounded-xl p-4">
                <EvidenceCapture
                  context={EvidenceContext.CASH}
                  referenceId={blindCloseSession?.id}
                  referenceType="cash_session"
                  label="📷 Evidencia de cierre (si hay varianza)"
                  allowSignature={false}
                  onCapture={(evidence) => setClosingEvidences(prev => [...prev, evidence])}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Recomendado si hay faltante o sobrante.
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowCloseModal(false); setBlindCloseSession(null); }}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitBlindClose}
                  disabled={closingAmount <= 0}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl disabled:opacity-50"
                >
                  Cerrar Caja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* CLOSING RESULT MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {showResultModal && closingResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className={`p-6 text-center ${
              closingResult.is_balanced ? 'bg-green-500/10' :
              closingResult.variance > 0 ? 'bg-blue-500/10' : 'bg-red-500/10'
            } rounded-t-xl`}>
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                closingResult.is_balanced ? 'bg-green-500/20' :
                closingResult.variance > 0 ? 'bg-blue-500/20' : 'bg-red-500/20'
              }`}>
                {closingResult.is_balanced ? (
                  <HiOutlineCheck className="w-10 h-10 text-green-400" />
                ) : (
                  <HiOutlineExclamation className="w-10 h-10 text-amber-400" />
                )}
              </div>

              <h2 className={`text-2xl font-bold mt-4 ${
                closingResult.is_balanced ? 'text-green-400' :
                closingResult.variance > 0 ? 'text-blue-400' : 'text-red-400'
              }`}>
                {closingResult.is_balanced ? '¡Caja Cuadrada!' :
                 closingResult.variance > 0 ? 'Sobrante' : 'Faltante'}
              </h2>

              {!closingResult.is_balanced && (
                <p className={`text-4xl font-bold mt-2 ${
                  closingResult.variance > 0 ? 'text-blue-400' : 'text-red-400'
                }`}>
                  {closingResult.variance > 0 ? '+' : ''}{formatCurrency(closingResult.variance)}
                </p>
              )}
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-slate-400">Esperado</p>
                  <p className="text-white font-bold">{formatCurrency(closingResult.expected_cash)}</p>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-3">
                  <p className="text-slate-400">Declarado</p>
                  <p className="text-white font-bold">{formatCurrency(closingResult.declared_amount)}</p>
                </div>
              </div>

              <div className="bg-slate-700/30 rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Ventas efectivo:</span>
                  <span className="text-green-400">{formatCurrency(closingResult.total_sales)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Entradas:</span>
                  <span className="text-blue-400">{formatCurrency(closingResult.total_cash_in)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Salidas:</span>
                  <span className="text-red-400">{formatCurrency(closingResult.total_cash_out)}</span>
                </div>
              </div>

              <button
                onClick={() => { setShowResultModal(false); setClosingResult(null); }}
                className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* CASH IN MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {showCashInModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineArrowDown className="w-5 h-5 text-green-400" />
                Entrada de Efectivo
              </h3>
              <button onClick={() => setShowCashInModal(false)} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto</label>
                <input
                  type="number"
                  value={cashInOutAmount}
                  onChange={(e) => setCashInOutAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-xl text-white text-center focus:border-green-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Descripción</label>
                <input
                  type="text"
                  value={cashInOutDescription}
                  onChange={(e) => setCashInOutDescription(e.target.value)}
                  placeholder="Ej: Cambio del banco"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCashInModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCashIn}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                >
                  Registrar Entrada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {/* CASH OUT MODAL */}
      {/* ══════════════════════════════════════════════════════════════════════════════ */}
      {showCashOutModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineArrowUp className="w-5 h-5 text-red-400" />
                Salida de Efectivo
              </h3>
              <button onClick={() => setShowCashOutModal(false)} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto</label>
                <input
                  type="number"
                  value={cashInOutAmount}
                  onChange={(e) => setCashInOutAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-xl text-white text-center focus:border-red-500 outline-none"
                  autoFocus
                />
                {currentSession && (
                  <p className="text-xs text-slate-500 mt-1">
                    Disponible: {formatCurrency(currentSession.expected_cash)}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Descripción</label>
                <input
                  type="text"
                  value={cashInOutDescription}
                  onChange={(e) => setCashInOutDescription(e.target.value)}
                  placeholder="Ej: Pago a proveedor"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-red-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCashOutModal(false)}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCashOut}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl"
                >
                  Registrar Salida
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

export default function CashDrawer() {
  return (
    <CashDrawerErrorBoundary>
      <CashDrawerInner />
    </CashDrawerErrorBoundary>
  );
}
