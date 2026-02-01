/**
 * GENESIS - POS Advanced Components
 * Escáner de códigos de barras, Ventas fraccionadas, Crédito/Fiado
 */

import { useState, useEffect, useRef } from 'react';
import {
  HiOutlineCamera,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlineExclamation,
  HiOutlineLightBulb,
  HiOutlineUserAdd,
  HiOutlineScale,
  HiOutlineCreditCard,
  HiOutlineCash,
  HiOutlineDocumentText
} from 'react-icons/hi';

// ==================== ESCÁNER DE CÓDIGOS DE BARRAS ====================

export function BarcodeScanner({ isOpen, onClose, onScan }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        
        // Iniciar escaneo continuo
        requestAnimationFrame(scanFrame);
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('No se pudo acceder a la cámara. Verifica los permisos.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  const scanFrame = () => {
    if (!scanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Aquí iría la lógica de detección de código de barras
      // En producción usar librería como @nicolo-ribaudo/chokidar o quagga2
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      // Simulación: buscar patrones en la imagen
      // En producción reemplazar con decodificador real
      detectBarcode(imageData);
    }

    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  };

  const detectBarcode = (imageData) => {
    // Placeholder - en producción usar librería de detección
    // Por ahora usamos entrada manual como fallback
  };

  const handleManualInput = () => {
    const barcode = prompt('Ingresa el código de barras manualmente:');
    if (barcode) {
      handleBarcodeDetected(barcode);
    }
  };

  const handleBarcodeDetected = (barcode) => {
    if (barcode === lastScanned) return; // Evitar duplicados
    
    setLastScanned(barcode);
    onScan(barcode);
    
    // Vibrar si está disponible
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // Reset después de 2 segundos
    setTimeout(() => setLastScanned(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900">
        <h2 className="text-white font-medium flex items-center gap-2">
          <HiOutlineCamera className="w-5 h-5" />
          Escáner de Código de Barras
        </h2>
        <button 
          onClick={() => { stopCamera(); onClose(); }}
          className="text-white p-2"
        >
          <HiOutlineX className="w-6 h-6" />
        </button>
      </div>

      {/* Video/Camera area */}
      <div className="flex-1 relative">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center p-6">
              <HiOutlineExclamation className="w-16 h-16 mx-auto text-yellow-400 mb-4" />
              <p className="text-white mb-4">{error}</p>
              <button
                onClick={handleManualInput}
                className="bg-purple-600 text-white px-6 py-2 rounded-lg"
              >
                Ingresar código manualmente
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay con área de escaneo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-32 border-2 border-purple-500 rounded-lg relative">
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 animate-pulse" />
                <div className="absolute -top-2 -left-2 w-4 h-4 border-t-2 border-l-2 border-purple-500" />
                <div className="absolute -top-2 -right-2 w-4 h-4 border-t-2 border-r-2 border-purple-500" />
                <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-2 border-l-2 border-purple-500" />
                <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-2 border-r-2 border-purple-500" />
              </div>
            </div>

            {/* Estado */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
              {lastScanned ? (
                <div className="bg-green-500/20 border border-green-500 rounded-lg p-3 text-center">
                  <HiOutlineCheck className="w-6 h-6 mx-auto text-green-400 mb-1" />
                  <p className="text-green-400 font-mono">{lastScanned}</p>
                </div>
              ) : (
                <p className="text-white text-center">
                  Apunta el código de barras al centro de la pantalla
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer con opciones */}
      <div className="p-4 bg-slate-900 flex gap-4">
        <button
          onClick={handleManualInput}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg flex items-center justify-center gap-2"
        >
          Ingresar Manual
        </button>
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ==================== SELECTOR DE CANTIDAD FRACCIONADA ====================

export function FractionalQuantitySelector({ 
  product, 
  currentQuantity = 1, 
  onQuantityChange, 
  onConfirm, 
  onCancel 
}) {
  const [quantity, setQuantity] = useState(currentQuantity.toString());
  const [unit, setUnit] = useState(product.unit || 'unidad');
  
  const presetQuantities = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 5, 10];
  
  const handleQuantityChange = (value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0 && numValue <= product.stock) {
      setQuantity(value);
    }
  };

  const handleConfirm = () => {
    const numQuantity = parseFloat(quantity);
    if (numQuantity > 0 && numQuantity <= product.stock) {
      onQuantityChange(numQuantity);
      onConfirm?.();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-white">{product.name}</h3>
              <p className="text-sm text-slate-400">Stock: {product.stock} {unit}(s)</p>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-white">
              <HiOutlineX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Cantidad */}
        <div className="p-4 space-y-4">
          {/* Input principal */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="number"
                value={quantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                step="0.01"
                min="0"
                max={product.stock}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-2xl text-white text-center font-bold"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <HiOutlineScale className="w-5 h-5 text-slate-400" />
              </div>
            </div>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-3 text-white"
            >
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="lb">Libra</option>
              <option value="g">Gramo</option>
              <option value="litro">Litro</option>
              <option value="ml">Mililitro</option>
            </select>
          </div>

          {/* Presets rápidos */}
          <div className="grid grid-cols-5 gap-2">
            {presetQuantities.map((preset) => (
              <button
                key={preset}
                onClick={() => setQuantity(preset.toString())}
                disabled={preset > product.stock}
                className={`py-2 rounded-lg text-sm font-medium transition-colors ${
                  parseFloat(quantity) === preset
                    ? 'bg-purple-600 text-white'
                    : preset <= product.stock
                    ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Cálculo de precio */}
          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Precio unitario:</span>
              <span>${product.price?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-white">
              <span>Total:</span>
              <span className="text-green-400">
                ${(parseFloat(quantity || 0) * product.price).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={parseFloat(quantity) <= 0}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white py-3 rounded-lg font-medium"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MODAL DE VENTA A CRÉDITO (FIADO) ====================

export function CreditSaleModal({ 
  isOpen, 
  onClose, 
  cartTotal, 
  onConfirm,
  customers = [] 
}) {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', notes: '' });
  const [showNewForm, setShowNewForm] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [downPayment, setDownPayment] = useState('0');

  if (!isOpen) return null;

  const balance = cartTotal - parseFloat(downPayment || 0);

  const handleConfirm = () => {
    const customer = showNewForm ? newCustomer : selectedCustomer;
    
    if (!customer || (!customer.id && !customer.name)) {
      alert('Selecciona o crea un cliente');
      return;
    }

    onConfirm({
      customer,
      total: cartTotal,
      downPayment: parseFloat(downPayment || 0),
      balance,
      dueDate,
      isCredit: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <HiOutlineCreditCard className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Venta a Crédito (Fiado)</h3>
              <p className="text-sm text-slate-400">Total: ${cartTotal.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Selección de cliente */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Cliente</label>
            
            {!showNewForm ? (
              <>
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setSelectedCustomer(customer);
                  }}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                  <option value="">Seleccionar cliente...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </select>
                
                <button
                  onClick={() => setShowNewForm(true)}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
                >
                  <HiOutlineUserAdd className="w-4 h-4" />
                  Nuevo cliente
                </button>
              </>
            ) : (
              <div className="space-y-3 bg-slate-700/30 rounded-lg p-3">
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <input
                  type="tel"
                  placeholder="Teléfono"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                />
                <button
                  onClick={() => setShowNewForm(false)}
                  className="text-sm text-slate-400 hover:text-white"
                >
                  ← Seleccionar cliente existente
                </button>
              </div>
            )}
          </div>

          {/* Abono inicial */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Abono inicial (opcional)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input
                type="number"
                value={downPayment}
                onChange={(e) => setDownPayment(e.target.value)}
                min="0"
                max={cartTotal}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-4 py-2 text-white"
              />
            </div>
          </div>

          {/* Fecha de pago */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Fecha límite de pago</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Resumen */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total de la venta:</span>
                <span className="text-white">${cartTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Abono inicial:</span>
                <span className="text-green-400">-${parseFloat(downPayment || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t border-amber-500/30 pt-2 mt-2">
                <span className="text-amber-400">Saldo pendiente:</span>
                <span className="text-white">${balance.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Advertencia */}
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <HiOutlineLightBulb className="w-4 h-4 mt-0.5 text-yellow-400" />
            <p>
              Esta venta quedará registrada como cuenta por cobrar. 
              Podrás ver y gestionar los créditos en el módulo de Ventas.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <HiOutlineDocumentText className="w-5 h-5" />
            Registrar Fiado
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== CIERRE CIEGO DE CAJA ====================

export function BlindCashClose({ isOpen, onClose, onSubmit }) {
  const [counted, setCounted] = useState({
    bills_1000: 0,
    bills_500: 0,
    bills_200: 0,
    bills_100: 0,
    bills_50: 0,
    bills_20: 0,
    coins_20: 0,
    coins_10: 0,
    coins_5: 0,
    coins_1: 0
  });
  const [notes, setNotes] = useState('');

  const denominations = [
    { key: 'bills_1000', label: 'Billetes $1000', value: 1000 },
    { key: 'bills_500', label: 'Billetes $500', value: 500 },
    { key: 'bills_200', label: 'Billetes $200', value: 200 },
    { key: 'bills_100', label: 'Billetes $100', value: 100 },
    { key: 'bills_50', label: 'Billetes $50', value: 50 },
    { key: 'bills_20', label: 'Billetes $20', value: 20 },
    { key: 'coins_20', label: 'Monedas $20', value: 20 },
    { key: 'coins_10', label: 'Monedas $10', value: 10 },
    { key: 'coins_5', label: 'Monedas $5', value: 5 },
    { key: 'coins_1', label: 'Monedas $1', value: 1 },
  ];

  const totalCounted = denominations.reduce(
    (sum, d) => sum + (counted[d.key] * d.value), 
    0
  );

  const handleSubmit = () => {
    onSubmit({
      counted_amount: totalCounted,
      denomination_breakdown: counted,
      notes,
      counted_at: new Date().toISOString()
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-blue-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <HiOutlineCash className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-white">Cierre Ciego de Caja</h3>
              <p className="text-sm text-slate-400">Cuenta el efectivo sin ver el saldo esperado</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
          {/* Denominaciones */}
          <div className="space-y-2">
            {denominations.map((d) => (
              <div key={d.key} className="flex items-center justify-between gap-4">
                <span className="text-sm text-slate-300 flex-1">{d.label}</span>
                <input
                  type="number"
                  value={counted[d.key]}
                  onChange={(e) => setCounted({ 
                    ...counted, 
                    [d.key]: parseInt(e.target.value) || 0 
                  })}
                  min="0"
                  className="w-20 bg-slate-900 border border-slate-600 rounded-lg px-3 py-1 text-white text-center"
                />
                <span className="text-sm text-slate-400 w-24 text-right">
                  ${(counted[d.key] * d.value).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          {/* Total contado */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg text-blue-300">Total Contado:</span>
              <span className="text-2xl font-bold text-white">${totalCounted.toLocaleString()}</span>
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Observaciones</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Notas adicionales..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
          >
            Enviar Conteo
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== REGISTRO DE MERMAS ====================

export function WasteRecordModal({ isOpen, onClose, products, onSubmit }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('expired');
  const [notes, setNotes] = useState('');

  const reasons = [
    { value: 'expired', label: 'Producto vencido' },
    { value: 'damaged', label: 'Producto dañado' },
    { value: 'dropped', label: 'Se cayó/rompió' },
    { value: 'overproduction', label: 'Sobreproducción' },
    { value: 'quality', label: 'No pasó control de calidad' },
    { value: 'other', label: 'Otro' },
  ];

  const handleSubmit = () => {
    if (!selectedProduct || !quantity) {
      alert('Selecciona un producto y cantidad');
      return;
    }

    onSubmit({
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: parseFloat(quantity),
      reason,
      notes,
      recorded_at: new Date().toISOString()
    });

    // Reset form
    setSelectedProduct(null);
    setQuantity('');
    setNotes('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-700 bg-red-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <HiOutlineExclamation className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-medium text-white">Registrar Merma</h3>
                <p className="text-sm text-slate-400">Desperdicio o pérdida de producto</p>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white">
              <HiOutlineX className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Producto */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Producto</label>
            <select
              value={selectedProduct?.id || ''}
              onChange={(e) => {
                const product = products.find(p => p.id === e.target.value);
                setSelectedProduct(product);
              }}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              <option value="">Seleccionar producto...</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stock: {p.stock})
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Cantidad perdida</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="0"
              max={selectedProduct?.stock || 999}
              step="0.01"
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            />
          </div>

          {/* Razón */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Motivo</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
            >
              {reasons.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">Notas adicionales</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Detalles adicionales..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white resize-none"
            />
          </div>

          {/* Costo estimado */}
          {selectedProduct && quantity && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex justify-between">
                <span className="text-red-300">Costo de la pérdida:</span>
                <span className="text-white font-bold">
                  ${(parseFloat(quantity) * selectedProduct.price).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedProduct || !quantity}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-slate-600 text-white py-3 rounded-lg font-medium"
          >
            Registrar Merma
          </button>
        </div>
      </div>
    </div>
  );
}

export default {
  BarcodeScanner,
  FractionalQuantitySelector,
  CreditSaleModal,
  BlindCashClose,
  WasteRecordModal
};
