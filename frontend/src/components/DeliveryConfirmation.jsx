/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - DELIVERY CONFIRMATION COMPONENT v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Delivery confirmation with digital signature and photo evidence
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState } from 'react';
import EvidenceCapture, { EvidenceContext, EvidenceDB } from './EvidenceVault';
import { db, logAudit } from '../services/dataService';
import { formatCurrency } from '../config/businessConfig';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import toast from 'react-hot-toast';
import {
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineTruck,
  HiOutlinePencilAlt,
  HiOutlineCamera,
} from 'react-icons/hi';

export default function DeliveryConfirmation({ 
  saleId, 
  customerName,
  items = [],
  total,
  onConfirm,
  onCancel 
}) {
  const [receiverName, setReceiverName] = useState('');
  const [receiverIdNumber, setReceiverIdNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [evidences, setEvidences] = useState([]);
  const [hasSignature, setHasSignature] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEvidenceCapture = (evidence) => {
    setEvidences(prev => [...prev, evidence]);
    
    if (evidence.type === 'signature') {
      setHasSignature(true);
    }
  };

  const handleConfirm = async () => {
    if (!hasSignature) {
      sentinelService.addAlert(
        ALERT_TYPES.EVIDENCE_MISSING,
        'Entrega sin firma requerida',
        {
          reference_type: 'sale',
          reference_id: saleId,
          evidence_required: true
        }
      );
      toast.error('Se requiere firma de recibido');
      return;
    }

    if (!receiverName.trim()) {
      toast.error('Ingresa el nombre de quien recibe');
      return;
    }

    setIsProcessing(true);

    try {
      // Create delivery record
      const deliveryId = `del_${Date.now()}`;
      
      await db.deliveries?.add({
        id: deliveryId,
        sale_id: saleId,
        customer_name: customerName,
        receiver_name: receiverName,
        receiver_id: receiverIdNumber,
        items_count: items.length,
        total,
        notes,
        status: 'delivered',
        evidence_ids: evidences.map(e => e.id),
        delivered_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      // Update sale status
      await db.sales?.update(saleId, {
        delivery_status: 'delivered',
        delivered_at: new Date().toISOString()
      });

      // Audit log
      await logAudit('delivery', deliveryId, 'create', null, {
        sale_id: saleId,
        receiver: receiverName,
        has_signature: hasSignature,
        evidence_count: evidences.length
      });

      toast.success('✓ Entrega confirmada');
      
      if (onConfirm) {
        onConfirm({
          deliveryId,
          receiverName,
          evidences
        });
      }
    } catch (error) {
      console.error('Delivery confirmation error:', error);
      toast.error('Error al confirmar entrega');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
          <h3 className="font-medium text-white flex items-center gap-2">
            <HiOutlineTruck className="w-5 h-5 text-green-400" />
            Confirmar Entrega
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-white">
            <HiOutlineX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Order Summary */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <p className="text-slate-400 text-sm">Cliente</p>
            <p className="text-white font-medium">{customerName}</p>
            <div className="mt-2 flex justify-between">
              <span className="text-slate-400">Total pedido:</span>
              <span className="text-green-400 font-bold">{formatCurrency(total)}</span>
            </div>
            <p className="text-slate-500 text-xs mt-1">{items.length} productos</p>
          </div>

          {/* Receiver Info */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Nombre de quien recibe *</label>
            <input
              type="text"
              value={receiverName}
              onChange={(e) => setReceiverName(e.target.value)}
              placeholder="Nombre completo"
              required
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-1">Cédula (opcional)</label>
            <input
              type="text"
              value={receiverIdNumber}
              onChange={(e) => setReceiverIdNumber(e.target.value)}
              placeholder="000-0000000-0"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
            />
          </div>

          {/* Evidence Capture */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
            <EvidenceCapture
              context={EvidenceContext.DELIVERY}
              referenceId={saleId}
              referenceType="sale"
              label="✍️ Firma de Recibido (Obligatorio) + Foto de Entrega"
              allowSignature={true}
              allowCamera={true}
              allowGallery={true}
              required={true}
              onCapture={handleEvidenceCapture}
            />

            {/* Validation */}
            {!hasSignature && (
              <div className="mt-3 flex items-center gap-2 text-amber-400 text-sm">
                <HiOutlinePencilAlt className="w-4 h-4" />
                Se requiere firma digital de quien recibe
              </div>
            )}

            {hasSignature && (
              <div className="mt-3 flex items-center gap-2 text-green-400 text-sm">
                <HiOutlineCheck className="w-4 h-4" />
                Firma capturada
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm text-slate-400 mb-1">Notas de entrega</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing || !hasSignature || !receiverName.trim()}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <HiOutlineCheck className="w-5 h-5" />
              {isProcessing ? 'Confirmando...' : 'Confirmar Entrega'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
