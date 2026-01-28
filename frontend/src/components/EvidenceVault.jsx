/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - EVIDENCE VAULT v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Universal Digital Evidence Capture System
 * Features: Camera, Gallery, Digital Signature, WebP Compression
 * Compliance: Forensic-grade traceability
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { db } from '../services/dataService';
import sentinelService from '../services/SentinelService';
import toast from 'react-hot-toast';
import { useSubscription } from '../context/SubscriptionContext';
import {
  HiOutlineCamera,
  HiOutlinePhotograph,
  HiOutlinePencilAlt,
  HiOutlineX,
  HiOutlineTrash,
  HiOutlineEye,
  HiOutlineDocumentAdd,
  HiOutlineCheck,
  HiOutlineRefresh,
  HiOutlineSparkles,
} from 'react-icons/hi';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const EvidenceType = {
  PHOTO: 'photo',
  SIGNATURE: 'signature',
  DOCUMENT: 'document',
  RECEIPT: 'receipt'
};

export const EvidenceContext = {
  SALE: 'sale',
  EXPENSE: 'expense',
  INVENTORY: 'inventory',
  DELIVERY: 'delivery',
  SHRINKAGE: 'shrinkage',
  PAYMENT: 'payment',
  CASH: 'cash'
};

const MAX_IMAGE_SIZE = 1920; // Max dimension
const COMPRESSION_QUALITY = 0.8;

// ══════════════════════════════════════════════════════════════════════════════
// IMAGE COMPRESSION UTILITY
// ══════════════════════════════════════════════════════════════════════════════

async function compressImage(file, maxSize = MAX_IMAGE_SIZE, quality = COMPRESSION_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP (or JPEG as fallback)
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                dataUrl: canvas.toDataURL('image/webp', quality),
                width,
                height,
                originalSize: file.size,
                compressedSize: blob.size
              });
            } else {
              // Fallback to JPEG
              canvas.toBlob(
                (jpegBlob) => {
                  resolve({
                    blob: jpegBlob,
                    dataUrl: canvas.toDataURL('image/jpeg', quality),
                    width,
                    height,
                    originalSize: file.size,
                    compressedSize: jpegBlob?.size || 0
                  });
                },
                'image/jpeg',
                quality
              );
            }
          },
          'image/webp',
          quality
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// EVIDENCE DATABASE SERVICE
// ══════════════════════════════════════════════════════════════════════════════

export const EvidenceDB = {
  async save(evidence) {
    const id = `ev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = {
      id,
      ...evidence,
      created_at: new Date().toISOString(),
      synced: 0,
      deleted_at: null // Soft delete support
    };

    await db.evidences?.add(record);
    try {
      sentinelService.resolveAlertsByReference(record.reference_type, record.reference_id);
    } catch {}
    return record;
  },

  async get(id) {
    return await db.evidences?.get(id);
  },

  async getByReference(referenceType, referenceId) {
    return await db.evidences
      ?.where('reference_id')
      .equals(referenceId)
      .and(e => e.reference_type === referenceType && !e.deleted_at)
      .toArray() || [];
  },

  async softDelete(id) {
    await db.evidences?.update(id, {
      deleted_at: new Date().toISOString()
    });
  },

  async markSynced(id) {
    await db.evidences?.update(id, { synced: 1 });
  },

  async getPendingSync() {
    return await db.evidences
      ?.where('synced')
      .equals(0)
      .and(e => !e.deleted_at)
      .toArray() || [];
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// SIGNATURE PAD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasContent(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const handleSave = () => {
    if (!hasContent) {
      toast.error('Por favor, firma primero');
      return;
    }
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed border-slate-600 rounded-xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={200}
          className="w-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <p className="text-center text-slate-400 text-sm">Firme con el dedo o mouse</p>
      <div className="flex gap-3">
        <button
          onClick={clear}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
        >
          <HiOutlineRefresh className="w-5 h-5" />
          Limpiar
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={!hasContent}
          className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
        >
          <HiOutlineCheck className="w-5 h-5" />
          Guardar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EVIDENCE CAPTURE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function EvidenceCapture({
  context = EvidenceContext.SALE,
  referenceId = null,
  referenceType = null,
  required = false,
  multiple = true,
  allowSignature = true,
  allowCamera = true,
  allowGallery = true,
  onCapture = null,
  onAIAnalysis = null,
  label = 'Adjuntar Evidencia',
  className = ''
}) {
  const { hasPlanAtLeast } = useSubscription();
  const [evidences, setEvidences] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState(null); // 'camera', 'gallery', 'signature'
  const [previewImage, setPreviewImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Load existing evidences if reference provided
  useEffect(() => {
    if (referenceId && referenceType) {
      loadEvidences();
    }
  }, [referenceId, referenceType]);

  const loadEvidences = async () => {
    const loaded = await EvidenceDB.getByReference(referenceType, referenceId);
    setEvidences(loaded);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // CAMERA HANDLING
  // ════════════════════════════════════════════════════════════════════════════

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setModalMode('camera');
      setShowModal(true);
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('No se pudo acceder a la cámara');
      // Fallback to file input
      cameraInputRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);

    canvas.toBlob(async (blob) => {
      if (blob) {
        await processImage(blob, EvidenceType.PHOTO);
      }
    }, 'image/jpeg', 0.9);

    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowModal(false);
    setModalMode(null);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ════════════════════════════════════════════════════════════════════════════

  const handleFileSelect = async (e, type = EvidenceType.PHOTO) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      await processImage(file, type);
    }

    e.target.value = '';
  };

  const processImage = async (fileOrBlob, type) => {
    setIsProcessing(true);

    try {
      // Convert Blob to File if needed
      const file = fileOrBlob instanceof File 
        ? fileOrBlob 
        : new File([fileOrBlob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // Compress image
      const compressed = await compressImage(file);

      // Create evidence record
      const evidence = await EvidenceDB.save({
        type,
        context,
        reference_id: referenceId,
        reference_type: referenceType,
        data: compressed.dataUrl,
        metadata: {
          originalName: file.name,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize,
          width: compressed.width,
          height: compressed.height,
          mimeType: 'image/webp',
          capturedAt: new Date().toISOString()
        },
        ai_analyzed: false,
        ai_result: null
      });

      setEvidences(prev => [...prev, evidence]);

      if (onCapture) {
        onCapture(evidence);
      }

      toast.success('Evidencia guardada');

      // Trigger AI analysis if handler provided
      if (onAIAnalysis && type === EvidenceType.RECEIPT) {
        if (hasPlanAtLeast("MAX")) {
          analyzeWithAI(evidence);
        } else {
          toast("IA disponible solo en plan MAX 🔒", { duration: 2500 });
        }
      }

    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Error al procesar imagen');
    } finally {
      setIsProcessing(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // SIGNATURE HANDLING
  // ════════════════════════════════════════════════════════════════════════════

  const handleSignatureSave = async (dataUrl) => {
    setIsProcessing(true);

    try {
      const evidence = await EvidenceDB.save({
        type: EvidenceType.SIGNATURE,
        context,
        reference_id: referenceId,
        reference_type: referenceType,
        data: dataUrl,
        metadata: {
          capturedAt: new Date().toISOString(),
          mimeType: 'image/png'
        },
        ai_analyzed: false,
        ai_result: null
      });

      setEvidences(prev => [...prev, evidence]);

      if (onCapture) {
        onCapture(evidence);
      }

      toast.success('Firma guardada');
      setShowModal(false);
      setModalMode(null);

    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Error al guardar firma');
    } finally {
      setIsProcessing(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // AI ANALYSIS
  // ════════════════════════════════════════════════════════════════════════════

  const analyzeWithAI = async (evidence) => {
    if (!onAIAnalysis) return;

    setIsAnalyzing(true);
    try {
      const result = await onAIAnalysis(evidence);
      
      // Update evidence with AI result
      await db.evidences?.update(evidence.id, {
        ai_analyzed: true,
        ai_result: result,
        ai_analyzed_at: new Date().toISOString()
      });

      // Update local state
      setEvidences(prev => prev.map(e => 
        e.id === evidence.id 
          ? { ...e, ai_analyzed: true, ai_result: result }
          : e
      ));

    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ════════════════════════════════════════════════════════════════════════════
  // DELETE EVIDENCE
  // ════════════════════════════════════════════════════════════════════════════

  const deleteEvidence = async (id) => {
    if (!confirm('¿Eliminar esta evidencia?')) return;

    await EvidenceDB.softDelete(id);
    setEvidences(prev => prev.filter(e => e.id !== id));
    toast.success('Evidencia eliminada');
  };

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Label */}
      <label className="block text-sm text-slate-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {allowCamera && (
          <button
            type="button"
            onClick={startCamera}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
          >
            <HiOutlineCamera className="w-5 h-5" />
            Cámara
          </button>
        )}

        {allowGallery && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple={multiple}
              onChange={(e) => handleFileSelect(e, EvidenceType.PHOTO)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-50"
            >
              <HiOutlinePhotograph className="w-5 h-5" />
              Galería
            </button>
          </>
        )}

        {allowSignature && (
          <button
            type="button"
            onClick={() => { setModalMode('signature'); setShowModal(true); }}
            disabled={isProcessing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg disabled:opacity-50"
          >
            <HiOutlinePencilAlt className="w-5 h-5" />
            Firma
          </button>
        )}

        {/* Hidden camera input for fallback */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => handleFileSelect(e, EvidenceType.PHOTO)}
          className="hidden"
        />
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-blue-400 text-sm">
          <HiOutlineRefresh className="w-4 h-4 animate-spin" />
          Procesando...
        </div>
      )}

      {/* Evidence Grid */}
      {evidences.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-3">
          {evidences.map(evidence => (
            <div
              key={evidence.id}
              className="relative group aspect-square bg-slate-700 rounded-lg overflow-hidden"
            >
              <img
                src={evidence.data}
                alt="Evidencia"
                className="w-full h-full object-cover"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setPreviewImage(evidence.data)}
                  className="p-2 bg-white/20 hover:bg-white/30 rounded-full"
                >
                  <HiOutlineEye className="w-4 h-4 text-white" />
                </button>
                <button
                  onClick={() => deleteEvidence(evidence.id)}
                  className="p-2 bg-red-500/50 hover:bg-red-500/70 rounded-full"
                >
                  <HiOutlineTrash className="w-4 h-4 text-white" />
                </button>
              </div>

              {/* Type badge */}
              <div className="absolute top-1 left-1">
                {evidence.type === EvidenceType.SIGNATURE && (
                  <span className="px-1.5 py-0.5 bg-purple-500 text-white text-xs rounded">
                    Firma
                  </span>
                )}
                {evidence.ai_analyzed && (
                  <span className="px-1.5 py-0.5 bg-green-500 text-white text-xs rounded ml-1">
                    <HiOutlineSparkles className="w-3 h-3 inline" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Validation message */}
      {required && evidences.length === 0 && (
        <p className="text-amber-400 text-sm">* Se requiere al menos una evidencia</p>
      )}

      {/* Camera Modal */}
      {showModal && modalMode === 'camera' && (
        <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
          <div className="flex-1 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-full"
            />
          </div>
          <div className="p-6 flex justify-center gap-4">
            <button
              onClick={stopCamera}
              className="p-4 bg-slate-700 hover:bg-slate-600 text-white rounded-full"
            >
              <HiOutlineX className="w-8 h-8" />
            </button>
            <button
              onClick={capturePhoto}
              className="p-4 bg-white text-slate-900 rounded-full"
            >
              <HiOutlineCamera className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showModal && modalMode === 'signature' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Firma Digital</h3>
              <button
                onClick={() => { setShowModal(false); setModalMode(null); }}
                className="text-slate-400 hover:text-white"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={() => { setShowModal(false); setModalMode(null); }}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-full"
          >
            <HiOutlineX className="w-6 h-6 text-white" />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SPECIALIZED COMPONENTS
// ══════════════════════════════════════════════════════════════════════════════

// Receipt capture for expenses (with AI OCR)
export function ReceiptCapture({ onCapture, onAIAnalysis, ...props }) {
  return (
    <EvidenceCapture
      label="📸 Foto de Factura/Recibo"
      context={EvidenceContext.EXPENSE}
      allowSignature={false}
      onCapture={onCapture}
      onAIAnalysis={onAIAnalysis}
      {...props}
    />
  );
}

// Shrinkage evidence (required photo)
export function ShrinkageEvidence({ onCapture, ...props }) {
  return (
    <EvidenceCapture
      label="📷 Foto del Producto Dañado (Obligatorio)"
      context={EvidenceContext.SHRINKAGE}
      required={true}
      allowSignature={false}
      onCapture={onCapture}
      {...props}
    />
  );
}

// Delivery confirmation (signature + optional photo)
export function DeliveryConfirmation({ onCapture, ...props }) {
  return (
    <EvidenceCapture
      label="✍️ Firma de Recibido / Foto de Entrega"
      context={EvidenceContext.DELIVERY}
      allowSignature={true}
      allowCamera={true}
      onCapture={onCapture}
      {...props}
    />
  );
}
