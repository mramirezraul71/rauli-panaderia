/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - SHRINKAGE MODULE v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Inventory Loss/Waste Management with MANDATORY Evidence
 * Compliance: Forensic audit trail, AI damage assessment
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, ProductsDB, logAudit } from '../services/dataService';
import { formatCurrency } from '../config/businessConfig';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import EvidenceCapture from '../components/Evidence/EvidenceCapture';
// import aiVision from '../core/AIVision'; // ⭐ IA desactivada por ahora
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlineExclamationCircle,
  HiOutlineSparkles,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineCamera,
  HiOutlineTrash,
  HiOutlineRefresh,
  HiOutlineCube,
  HiOutlinePhotograph,
  HiOutlineClipboardCheck,
  HiOutlineEye,
} from 'react-icons/hi';

// ══════════════════════════════════════════════════════════════════════════════
// SHRINKAGE REASONS
// ══════════════════════════════════════════════════════════════════════════════

const SHRINKAGE_REASONS = [
  { id: 'vencido', name: 'Producto Vencido', icon: '📅', requiresEvidence: true },
  { id: 'danado', name: 'Producto Dañado', icon: '💔', requiresEvidence: true },
  { id: 'contaminado', name: 'Contaminación', icon: '⚠️', requiresEvidence: true },
  { id: 'robo', name: 'Robo/Pérdida', icon: '🔒', requiresEvidence: true },
  { id: 'produccion', name: 'Error de Producción', icon: '🏭', requiresEvidence: true },
  { id: 'devolucion', name: 'Devolución de Cliente', icon: '↩️', requiresEvidence: false },
  { id: 'otro', name: 'Otro', icon: '📋', requiresEvidence: true },
];

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function Shrinkage() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzingAI, setIsAnalyzingAI] = useState(false);
  const [evidences, setEvidences] = useState([]);
  const [aiAssessment, setAiAssessment] = useState(null);
  const [previewEvidence, setPreviewEvidence] = useState(null);

  // Form state
  const [form, setForm] = useState({
    product_id: '',
    quantity: '1',
    reason: '',
    notes: ''
  });

  // Load products
  const products = useLiveQuery(async () => {
    return await db.products?.where('active').equals(1).toArray() || [];
  }, []) || [];

  // Load shrinkage records
  const shrinkageRecords = useLiveQuery(async () => {
    return await db.shrinkage
      ?.orderBy('date')
      .reverse()
      .filter(s => !s.deleted_at)
      .limit(50)
      .toArray() || [];
  }, []) || [];

  // Stats
  const stats = useLiveQuery(async () => {
    const all = await db.shrinkage?.filter(s => !s.deleted_at).toArray() || [];
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthRecords = all.filter(s => s.date?.startsWith(thisMonth));
    
    return {
      totalLoss: monthRecords.reduce((sum, s) => sum + (s.total_loss || 0), 0),
      countMonth: monthRecords.length,
      pendingApproval: all.filter(s => !s.approved).length
    };
  }, []) || { totalLoss: 0, countMonth: 0, pendingApproval: 0 };

  // ════════════════════════════════════════════════════════════════════════════
  // EVIDENCE + AI ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════

  const handleEvidenceChange = async (newEvidences) => {
    setEvidences(newEvidences);
    
    // ⭐ IA desactivada por ahora - comentado
    // if (newEvidences.length > 0) {
    //   const latestEvidence = newEvidences[newEvidences.length - 1];
    //   await assessDamageWithAI(latestEvidence);
    // }
  };

  const assessDamageWithAI = async (evidence) => {
    // ⭐ IA desactivada - función comentada
    console.log('IA no disponible en esta versión');
    return;
    
    /* CÓDIGO ORIGINAL COMENTADO
    setIsAnalyzingAI(true);
    setAiAssessment(null);

    try {
      toast.loading('Evaluando daño con IA...', { id: 'ai-assess' });
      
      const result = await aiVision.assessDamage(evidence.data);
      
      toast.dismiss('ai-assess');

      if (result.success) {
        setAiAssessment(result);
        
        const reasonMapping = {
          'vencido': 'vencido',
          'roto': 'danado',
          'contaminado': 'contaminado',
          'defectuoso': 'produccion'
        };
        
        const mappedReason = reasonMapping[result.assessment?.damage_type] || form.reason;
        
        setForm(prev => ({
          ...prev,
          reason: mappedReason || prev.reason,
          notes: result.assessment?.description || prev.notes
        }));

        toast.success(`✨ IA evaluó: ${result.assessment?.damage_type} - ${result.assessment?.severity}`);
      } else if (result.offline) {
        toast.info('IA no disponible, continúa manualmente');
      }
    } catch (error) {
      toast.dismiss('ai-assess');
      console.error('AI assessment error:', error);
    } finally {
      setIsAnalyzingAI(false);
    }
    */
  };

  // ════════════════════════════════════════════════════════════════════════════
  // FORM HANDLERS
  // ════════════════════════════════════════════════════════════════════════════

  const resetForm = () => {
    setForm({
      product_id: '',
      quantity: '1',
      reason: '',
      notes: ''
    });
    setEvidences([]);
    setAiAssessment(null);
  };

  const openNewShrinkage = () => {
    resetForm();
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const selectedReason = SHRINKAGE_REASONS.find(r => r.id === form.reason);
    
    // Validate mandatory evidence
    if (selectedReason?.requiresEvidence && evidences.length === 0) {
      sentinelService.addAlert(
        ALERT_TYPES.EVIDENCE_MISSING,
        'Merma registrada sin evidencia requerida',
        {
          reference_type: 'shrinkage',
          reference_id: form.product_id,
          reason: form.reason,
          evidence_required: true
        }
      );
      toast.error('⚠️ Se requiere foto del producto para este tipo de merma');
      return;
    }

    if (!form.product_id) {
      toast.error('Selecciona un producto');
      return;
    }

    if (!form.reason) {
      toast.error('Selecciona un motivo');
      return;
    }

    const quantity = parseFloat(form.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Cantidad inválida');
      return;
    }

    setIsProcessing(true);

    try {
      // Get product for loss calculation
      const product = await db.products.get(form.product_id);
      const total_loss = (product?.cost || 0) * quantity;

      const shrinkageData = {
        product_id: form.product_id,
        product_name: product?.name,
        quantity: quantity,
        reason: form.reason,
        notes: form.notes,
        total_loss: total_loss,
        evidences: evidences,
        ai_assessed: !!aiAssessment,
        ai_data: aiAssessment,
        date: new Date().toISOString(),
        approved: false,
        user_id: user?.id
      };

      await db.shrinkage.add(shrinkageData);

      // Update product stock
      await db.products.update(form.product_id, {
        stock: Math.max(0, (product?.stock || 0) - quantity)
      });

      toast.success('✓ Merma registrada correctamente');
      setShowModal(false);
      resetForm();
    } catch (error) {
      console.error('Error recording shrinkage:', error);
      toast.error(error.message || 'Error al registrar merma');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedProduct = products.find(p => p.id === form.product_id);
  const selectedReason = SHRINKAGE_REASONS.find(r => r.id === form.reason);
  const estimatedLoss = selectedProduct 
    ? (selectedProduct.cost || 0) * (parseFloat(form.quantity) || 0)
    : 0;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Mermas y Pérdidas</h1>
          <p className="text-slate-400">Registro con evidencia fotográfica obligatoria</p>
        </div>
        <button
          onClick={openNewShrinkage}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Registrar Merma
        </button>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <HiOutlineExclamationCircle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-400">Política de Evidencias</p>
            <p className="text-sm text-amber-400/80">
              Toda merma o pérdida requiere evidencia fotográfica del producto dañado para auditoría.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-amber-500/30 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <HiOutlineCube className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Pérdida del Mes</p>
              <p className="text-2xl font-bold text-amber-400">{formatCurrency(stats.totalLoss)}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/20 rounded-xl">
              <HiOutlineClipboardCheck className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Registros este Mes</p>
              <p className="text-2xl font-bold text-white">{stats.countMonth}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-xl">
              <HiOutlineExclamationCircle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-slate-400 text-sm">Pendientes Aprobar</p>
              <p className="text-2xl font-bold text-white">{stats.pendingApproval}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden min-h-[520px]">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-medium text-white">Historial de Mermas</h3>
        </div>

        {shrinkageRecords.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <HiOutlineCube className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No hay mermas registradas</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700 max-h-[calc(100vh-24rem)] overflow-y-auto">
            {shrinkageRecords.map(record => (
              <div key={record.id} className="p-4 hover:bg-slate-700/30 flex items-center gap-4">
                {/* Evidence Thumbnail */}
                <div 
                  className="w-16 h-16 bg-slate-700 rounded-lg overflow-hidden cursor-pointer flex-shrink-0"
                  onClick={() => {
                    if (record.evidences && record.evidences.length > 0) {
                      setPreviewEvidence(record.evidences[0].data);
                    }
                  }}
                >
                  {record.evidences && record.evidences.length > 0 ? (
                    <img 
                      src={record.evidences[0].data} 
                      alt="Evidencia" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <HiOutlineX className="w-6 h-6" />
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{record.product_name}</span>
                    {!record.approved && (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded">
                        Pendiente
                      </span>
                    )}
                    {record.ai_assessed && (
                      <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded flex items-center gap-1">
                        <HiOutlineSparkles className="w-3 h-3" /> IA
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">
                    {SHRINKAGE_REASONS.find(r => r.id === record.reason)?.icon} {' '}
                    {SHRINKAGE_REASONS.find(r => r.id === record.reason)?.name || record.reason}
                  </p>
                  <p className="text-xs text-slate-500">{record.date}</p>
                </div>

                {/* Quantity & Loss */}
                <div className="text-right">
                  <p className="font-bold text-white">-{record.quantity} uds</p>
                  <p className="text-sm text-amber-400">{formatCurrency(record.total_loss)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Shrinkage Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800 z-10">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineExclamationCircle className="w-5 h-5 text-amber-400" />
                Registrar Merma
              </h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Evidence Capture - MANDATORY */}
              <EvidenceCapture
                context="shrinkage"
                transactionId="NEW"
                required={selectedReason?.requiresEvidence || false}
                onChange={handleEvidenceChange}
                existingEvidences={evidences}
              />

              {/* Product Selection */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Producto</label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 outline-none"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Cantidad Perdida</label>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  min="1"
                  max={selectedProduct?.stock || 999}
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 outline-none"
                />
                {selectedProduct && (
                  <p className="text-xs text-slate-500 mt-1">
                    Stock actual: {selectedProduct.stock} | Costo unitario: {formatCurrency(selectedProduct.cost)}
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Motivo de la Pérdida</label>
                <div className="grid grid-cols-2 gap-2">
                  {SHRINKAGE_REASONS.map(reason => (
                    <button
                      key={reason.id}
                      type="button"
                      onClick={() => setForm({ ...form, reason: reason.id })}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        form.reason === reason.id
                          ? 'border-amber-500 bg-amber-500/20'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <span className="text-lg">{reason.icon}</span>
                      <span className={`block text-sm mt-1 ${
                        form.reason === reason.id ? 'text-amber-400' : 'text-slate-400'
                      }`}>
                        {reason.name}
                      </span>
                      {reason.requiresEvidence && (
                        <span className="text-xs text-red-400 block">📷 Requiere foto</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas Adicionales</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Describe la situación..."
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-amber-500 outline-none resize-none"
                />
              </div>

              {/* Estimated Loss */}
              {selectedProduct && estimatedLoss > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Pérdida Estimada:</span>
                    <span className="text-2xl font-bold text-red-400">{formatCurrency(estimatedLoss)}</span>
                  </div>
                </div>
              )}

              {/* Validation Warning */}
              {selectedReason?.requiresEvidence && evidences.length === 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
                  <HiOutlineCamera className="w-5 h-5 text-red-400" />
                  <span className="text-red-400 text-sm">Toma una foto del producto para continuar</span>
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
                  disabled={isProcessing || (selectedReason?.requiresEvidence && evidences.length === 0)}
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <HiOutlineRefresh className="w-5 h-5 animate-spin" />
                  ) : (
                    <HiOutlineCheck className="w-5 h-5" />
                  )}
                  Registrar Merma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Preview Modal */}
      {previewEvidence && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewEvidence(null)}
        >
          <button
            onClick={() => setPreviewEvidence(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full"
          >
            <HiOutlineX className="w-6 h-6 text-white" />
          </button>
          <img
            src={previewEvidence}
            alt="Evidencia"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}