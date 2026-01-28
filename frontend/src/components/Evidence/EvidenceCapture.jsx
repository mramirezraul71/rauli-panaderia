/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - EVIDENCE VAULT v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Universal Digital Evidence Capture System
 * Features: Camera, Gallery, Digital Signature, WebP Compression
 * Compliance: Forensic-grade traceability
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useState, useRef, useCallback } from 'react';
import { HiOutlineCamera, HiOutlinePhotograph, HiOutlinePencilAlt, HiOutlineX, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi';
import './EvidenceCapture.css';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const EvidenceType = {
  PHOTO: 'photo',
  SIGNATURE: 'signature',
  DOCUMENT: 'document',
  RECEIPT: 'receipt'
};

const MAX_IMAGE_SIZE = 1920;
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
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            const compressedFile = new File([blob], file.name, {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve(compressedFile);
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
// SIGNATURE PAD COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

function SignaturePad({ onSave, onCancel }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(
      e.nativeEvent.offsetX || e.touches[0].clientX - canvas.offsetLeft,
      e.nativeEvent.offsetY || e.touches[0].clientY - canvas.offsetTop
    );
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
    ctx.lineTo(
      e.nativeEvent.offsetX || e.touches[0].clientX - canvas.offsetLeft,
      e.nativeEvent.offsetY || e.touches[0].clientY - canvas.offsetTop
    );
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      onSave(blob);
    }, 'image/webp', 0.9);
  };

  return (
    <div className="signature-pad">
      <canvas
        ref={canvasRef}
        width={400}
        height={200}
        className="signature-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="signature-actions">
        <button onClick={clear} className="btn-clear">
          <HiOutlineX size={18} />
          Limpiar
        </button>
        <button onClick={onCancel} className="btn-cancel">
          Cancelar
        </button>
        <button onClick={save} className="btn-save">
          <HiOutlineCamera size={18} />
          Guardar Firma
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN EVIDENCE CAPTURE COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function EvidenceCapture({
  context,
  transactionId,
  required = false,
  onChange,
  existingEvidences = []
}) {
  const [evidences, setEvidences] = useState(existingEvidences);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowModal(true);
      setModalMode('camera');
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setShowModal(false);
    setModalMode(null);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      await addEvidence(blob, EvidenceType.PHOTO);
      stopCamera();
    }, 'image/webp', 0.9);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FILE HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  const handleFileSelect = async (e, type) => {
    const files = Array.from(e.target.files);
    setIsProcessing(true);

    for (const file of files) {
      try {
        const compressed = await compressImage(file);
        await addEvidence(compressed, type);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }

    setIsProcessing(false);
    e.target.value = '';
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // EVIDENCE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  const addEvidence = async (blob, type) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const evidence = {
        id: `EV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        data: reader.result,
        context,
        transaction_id: transactionId,
        timestamp: new Date().toISOString(),
        size: blob.size,
        ai_analyzed: false
      };

      const updated = [...evidences, evidence];
      setEvidences(updated);
      if (onChange) onChange(updated);
    };
    reader.readAsDataURL(blob);
  };

  const deleteEvidence = (id) => {
    const updated = evidences.filter(e => e.id !== id);
    setEvidences(updated);
    if (onChange) onChange(updated);
  };

  const handleSignatureSave = (blob) => {
    addEvidence(blob, EvidenceType.SIGNATURE);
    setShowModal(false);
    setModalMode(null);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="evidence-capture">
      <div className="evidence-header">
        <h4 className="evidence-title">
          📸 Evidencias Digitales
          {required && <span className="required">*</span>}
        </h4>
        <span className="evidence-count">{evidences.length} archivo(s)</span>
      </div>

      {/* Action Buttons */}
      <div className="evidence-actions">
        <button
          type="button"
          onClick={startCamera}
          className="btn-evidence btn-camera"
          title="Tomar foto con cámara"
        >
          <HiOutlineCamera size={20} />
          Cámara
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn-evidence btn-gallery"
          title="Seleccionar de galería"
        >
          <HiOutlinePhotograph size={20} />
          Galería
        </button>

        <button
          type="button"
          onClick={() => {
            setShowModal(true);
            setModalMode('signature');
          }}
          className="btn-evidence btn-signature"
          title="Firma digital"
        >
          <HiOutlinePencilAlt size={20} />
          Firma
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => handleFileSelect(e, EvidenceType.PHOTO)}
          className="hidden"
        />

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
        <div className="processing-indicator">
          <div className="spinner"></div>
          Procesando...
        </div>
      )}

      {/* Evidence Grid */}
      {evidences.length > 0 && (
        <div className="evidence-grid">
          {evidences.map(evidence => (
            <div key={evidence.id} className="evidence-item">
              <img
                src={evidence.data}
                alt="Evidencia"
                className="evidence-image"
              />

              <div className="evidence-overlay">
                <button
                  onClick={() => setPreviewImage(evidence.data)}
                  className="btn-preview"
                  title="Ver"
                >
                  <HiOutlineEye size={18} />
                </button>
                <button
                  onClick={() => deleteEvidence(evidence.id)}
                  className="btn-delete"
                  title="Eliminar"
                >
                  <HiOutlineTrash size={18} />
                </button>
              </div>

              {evidence.type === EvidenceType.SIGNATURE && (
                <span className="evidence-badge">Firma</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Validation message */}
      {required && evidences.length === 0 && (
        <p className="validation-message">* Se requiere al menos una evidencia</p>
      )}

      {/* Camera Modal */}
      {showModal && modalMode === 'camera' && (
        <div className="modal-overlay">
          <div className="camera-modal">
            <video ref={videoRef} autoPlay playsInline className="camera-video" />
            <div className="camera-controls">
              <button onClick={stopCamera} className="btn-close">
                <HiOutlineX size={32} />
              </button>
              <button onClick={capturePhoto} className="btn-capture">
                <HiOutlineCamera size={32} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showModal && modalMode === 'signature' && (
        <div className="modal-overlay">
          <div className="signature-modal">
            <h3>Firma Digital</h3>
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={() => {
                setShowModal(false);
                setModalMode(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="preview-modal">
            <button onClick={() => setPreviewImage(null)} className="btn-close-preview">
              <HiOutlineX size={24} />
            </button>
            <img src={previewImage} alt="Vista previa" className="preview-image" />
          </div>
        </div>
      )}
    </div>
  );
}
