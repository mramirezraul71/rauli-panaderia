import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../services/dataService";
import EvidenceCapture from "../components/Evidence/EvidenceCapture";
import toast from "react-hot-toast";
import { HiOutlineX, HiOutlineCheck } from "react-icons/hi";
import cashSession from "../core/CashSession";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, getBusinessConfig } from "../config/businessConfig";
import sentinelService, { ALERT_TYPES } from "../services/SentinelService";
import { useCommandCenter } from "../context/CommandCenterContext";

export default function POS() {
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
  const { user } = useAuth();
  const { on } = useCommandCenter();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [evidences, setEvidences] = useState([]);
  const [saleEvidences, setSaleEvidences] = useState([]);
  const [showSaleEvidence, setShowSaleEvidence] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [pendingSaleId, setPendingSaleId] = useState(null);
  const [creditCustomerId, setCreditCustomerId] = useState("");
  const [creditCash, setCreditCash] = useState("");
  const [creditLog, setCreditLog] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [cashReceived, setCashReceived] = useState("");
  const [isDelivery, setIsDelivery] = useState(false);
  const [deliveryCustomerId, setDeliveryCustomerId] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [searchPulse, setSearchPulse] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await db.products?.where("active").equals(1).toArray() || [];
        setProducts(data);
        const customerList = await db.customers?.where("active").equals(1).toArray() || [];
        setCustomers(customerList);
        await loadCreditLog(customerList);
      } catch (e) { console.error(e); }
    };
    load();
  }, []);

  useEffect(() => {
    const unsubscribe = on("FOCUS_POS_SEARCH", () => {
      searchInputRef.current?.focus();
      setSearchPulse(true);
      window.setTimeout(() => setSearchPulse(false), 800);
    });
    return () => unsubscribe();
  }, [on]);

  const loadCreditLog = async (customerList = customers) => {
    try {
      const sales = await db.sales?.toArray() || [];
      const customerMap = (customerList || []).reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {});
      const credits = sales
        .filter(s => s.payment_method === "credito")
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 12)
        .map((sale) => {
          const customer = customerMap[sale.customer_id] || {};
          const cashPaid = Number(sale.cash_paid || 0);
          const totalDue = Number(sale.total || 0);
          const balanceDue = Number(sale.balance_due ?? (totalDue - cashPaid));
          return {
            id: sale.id,
            name: customer.name || "Cliente",
            phone: customer.phone || "-",
            customerId: sale.customer_id,
            cashPaid,
            totalDue,
            balanceDue: Math.max(balanceDue, 0),
            customerBalance: Number(customer.balance || 0),
            createdAt: sale.created_at
          };
        });
      setCreditLog(credits);
    } catch (e) {
      console.error("Error loading credit log:", e);
    }
  };

  const addToCart = (product) => {
    if (product?.quarantine || product?.quality_status === "cuarentena") {
      return toast.error("Producto en cuarentena. No se puede vender.");
    }
    setCart(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) {
        return prev.map(p => p.id === product.id ? { ...p, qty: p.qty + 1 } : p);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(p => p.id !== id));
  };

  const total = cart.reduce((sum, p) => sum + (p.price * p.qty), 0);
  const cashReceivedAmount = Number(cashReceived || 0);
  const changeDue = Math.max(cashReceivedAmount - total, 0);
  const creditTotal = total;
  const creditCashAmount = Number(creditCash || 0);
  const creditBalance = Math.max(creditTotal - creditCashAmount, 0);
  const selectedCustomer = customers.find((c) => String(c.id) === String(creditCustomerId));
  const selectedBalance = selectedCustomer?.balance || 0;

  const processCreditSale = async () => {
    if (!creditCustomerId) return toast.error("Selecciona el cliente del fiado");
    if (cart.length === 0) return toast.error("Carrito vacío");
    if (creditCashAmount < 0) return toast.error("Pago en efectivo inválido");
    if (creditCashAmount > creditTotal) return toast.error("El pago supera el total");

    try {
      const saleId = `sale_${Date.now()}`;
      const balance = Math.max(creditTotal - creditCashAmount, 0);
      const currency = getBusinessConfig().currency;

      await db.sales.add({
        id: saleId,
        items: cart,
        total: creditTotal,
        payment_method: "credito",
        payment_status: balance > 0 ? "pending" : "paid",
        currency,
        cash_paid: creditCashAmount,
        balance_due: balance,
        customer_id: Number(creditCustomerId),
        is_delivery: isDelivery ? 1 : 0,
        delivery_note: isDelivery ? deliveryNote : "",
        evidences: saleEvidences,
        created_at: new Date().toISOString(),
        voided_at: null
      });

      for (const item of cart) {
        const product = await db.products.get(item.id);
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - item.qty);
          await db.products.update(item.id, { stock: newStock });
        }
      }

      if (creditCashAmount > 0) {
        try {
          await cashSession.recordSale(creditCashAmount, saleId, user?.id);
        } catch (cashError) {
          console.warn("Fiado con pago parcial sin sesión de caja activa:", cashError.message);
        }
      }

      const customer = await db.customers.get(Number(creditCustomerId));
      if (customer && balance > 0) {
        await db.customers.update(customer.id, { balance: (customer.balance || 0) + balance });
      }

      try {
        await db.transactions?.add({
          type: "credit_sale",
          customer_id: Number(creditCustomerId),
          reference_id: saleId,
          date: new Date().toISOString(),
          deleted_at: null,
          amount: balance,
          cash_paid: creditCashAmount
        });
      } catch (txError) {
        console.warn("No se pudo registrar transacción de crédito:", txError);
      }

      setCart([]);
      setCreditCash("");
      setCreditCustomerId("");
      setIsDelivery(false);
      setDeliveryCustomerId("");
      setDeliveryNote("");
      setSaleEvidences([]);
      setShowSaleEvidence(false);
      toast.success("✓ Fiado registrado");
      await loadCreditLog();
    } catch (e) {
      toast.error("Error: " + e.message);
      console.error("Error en processCreditSale:", e);
    }
  };

  const processSale = async () => {
    if (cart.length === 0) return toast.error("Carrito vacío");
    if (paymentMethod === "efectivo" && cashReceivedAmount < total) {
      return toast.error("Efectivo insuficiente");
    }
    try {
      const saleId = `sale_${Date.now()}`;
      const currency = getBusinessConfig().currency;
      
      // 1. Guardar la venta
      await db.sales.add({
        id: saleId,
        items: cart,
        total,
        payment_method: paymentMethod,
        payment_status: "paid",
        currency,
        cash_received: paymentMethod === "efectivo" ? cashReceivedAmount : 0,
        change_due: paymentMethod === "efectivo" ? changeDue : 0,
        is_delivery: isDelivery ? 1 : 0,
        delivery_note: isDelivery ? deliveryNote : "",
        customer_id: isDelivery && deliveryCustomerId ? Number(deliveryCustomerId) : null,
        evidences: saleEvidences,
        created_at: new Date().toISOString(),
        voided_at: null
      });

      // 2. Actualizar stock del inventario (restar cantidad vendida)
      for (const item of cart) {
        const product = await db.products.get(item.id);
        if (product) {
          const newStock = Math.max(0, (product.stock || 0) - item.qty);
          await db.products.update(item.id, { stock: newStock });
        }
      }

      // 3. Registrar venta en la caja (CashFlow) - Sumar el total de la venta
      try {
        if (paymentMethod === "efectivo") {
          await cashSession.recordSale(total, saleId, user?.id);
        }
      } catch (cashError) {
        console.warn("Venta registrada sin sesión de caja activa:", cashError.message);
      }

      // 4. Registrar transacción contable básica
      try {
        await db.transactions?.add({
          type: "sale",
          customer_id: isDelivery && deliveryCustomerId ? Number(deliveryCustomerId) : null,
          reference_id: saleId,
          date: new Date().toISOString(),
          deleted_at: null,
          amount: total,
          payment_method: paymentMethod
        });
      } catch (txError) {
        console.warn("No se pudo registrar transacción:", txError);
      }

      // 5. Forzar persistencia inmediata en IndexedDB
      // IndexedDB ya persiste automáticamente, pero forzamos un flush para asegurar
      await db.transaction('rw', db.products, db.sales, async () => {
        // Las operaciones ya se completaron, esto solo asegura la transacción
      });

      // 6. Guardar snapshot en localStorage como backup
      try {
        const snapshot = {
          saleId,
          total,
          timestamp: new Date().toISOString(),
          items: cart.map(item => ({ id: item.id, name: item.name, qty: item.qty }))
        };
        const snapshotRaw = readWithMigration('genesis_sales_snapshot', 'rauli_sales_snapshot') || '[]';
        const existingSnapshots = JSON.parse(snapshotRaw);
        existingSnapshots.push(snapshot);
        // Mantener solo los últimos 50 snapshots
        const recentSnapshots = existingSnapshots.slice(-50);
        localStorage.setItem('genesis_sales_snapshot', JSON.stringify(recentSnapshots));
      } catch (localStorageError) {
        console.warn("No se pudo guardar snapshot en localStorage:", localStorageError);
      }

      // 7. Mostrar modal de firma (opcional)
      setPendingSaleId(saleId);
      setShowSignatureModal(true);
      
    } catch (e) {
      toast.error("Error: " + e.message);
      console.error("Error en processSale:", e);
    }
  };

  const completeSaleWithSignature = async () => {
    try {
      const thresholdSetting = await db.settings?.get("sale_evidence_threshold");
      const evidenceThreshold = thresholdSetting?.value ? Number(thresholdSetting.value) : 8000;
      // Update sale with evidences
      if (pendingSaleId && (evidences.length > 0 || saleEvidences.length > 0)) {
        await db.sales.update(pendingSaleId, {
          evidences: [...saleEvidences, ...evidences],
          delivery_confirmed: true
        });
        toast.success("✓ Venta completada con firma de entrega");
      } else {
        toast.success("✓ Venta completada");
        if (total >= evidenceThreshold) {
          sentinelService.addAlert(
            ALERT_TYPES.SALE_MISSING_EVIDENCE,
            'Venta de alto valor sin evidencia',
            {
              reference_type: 'sale',
              reference_id: pendingSaleId,
              total,
              threshold: evidenceThreshold,
              evidence_required: true
            }
          );
        }
      }

      // Reset everything
      setCart([]);
      setPaymentMethod("efectivo");
      setCashReceived("");
      setIsDelivery(false);
      setDeliveryCustomerId("");
      setDeliveryNote("");
      setEvidences([]);
      setSaleEvidences([]);
      setShowSaleEvidence(false);
      setShowSignatureModal(false);
      setPendingSaleId(null);
    } catch (e) {
      toast.error("Error al guardar firma: " + e.message);
    }
  };

  const skipSignature = async () => {
    toast.success("✓ Venta completada sin firma");
    const thresholdSetting = await db.settings?.get("sale_evidence_threshold");
    const evidenceThreshold = thresholdSetting?.value ? Number(thresholdSetting.value) : 8000;
    if (pendingSaleId && total >= evidenceThreshold) {
      sentinelService.addAlert(
        ALERT_TYPES.SALE_MISSING_EVIDENCE,
        'Venta de alto valor sin evidencia',
        {
          reference_type: 'sale',
          reference_id: pendingSaleId,
          total,
          threshold: evidenceThreshold,
          evidence_required: true
        }
      );
    }
    setCart([]);
    setPaymentMethod("efectivo");
    setCashReceived("");
    setIsDelivery(false);
    setDeliveryCustomerId("");
    setDeliveryNote("");
    setEvidences([]);
    setSaleEvidences([]);
    setShowSaleEvidence(false);
    setShowSignatureModal(false);
    setPendingSaleId(null);
  };

  const filtered = products.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="flex flex-col gap-6 min-h-[calc(100vh-12rem)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            ref={searchInputRef}
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Buscar producto..." 
            className={`w-full md:flex-1 px-4 py-4 bg-slate-800 border border-slate-700 rounded-lg text-white transition-all ${
              searchPulse ? "ring-2 ring-violet-400/70 shadow-[0_0_18px_rgba(139,92,246,0.35)]" : ""
            }`}
          />
        </div>

        <div className="grid gap-6 flex-1 min-h-[420px] grid-cols-1 xl:grid-cols-[22rem_1fr]">
          <div className="order-2 xl:order-1 w-full bg-slate-800 rounded-xl border border-slate-700 flex flex-col min-h-[420px]">
            <div className="p-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Carrito</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {cart.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Carrito vacío</p>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-900 rounded-lg p-3">
                    <div>
                      <p className="text-white text-sm">{item.name}</p>
                      <p className="text-slate-400 text-xs">
                        {item.qty} {item.unit || item.uom || "ud"} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-medium">{formatCurrency(item.price * item.qty)}</span>
                      <button 
                        onClick={() => removeFromCart(item.id)} 
                        className="text-red-400 hover:text-red-300 text-lg"
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-700 space-y-3">
              <div className="flex justify-between text-xl font-bold">
                <span className="text-white">Total:</span>
                <span className="text-emerald-400">{formatCurrency(total)}</span>
              </div>
              <button 
                onClick={processSale} 
                disabled={cart.length === 0} 
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all"
              >
                Cobrar
              </button>
            </div>
          </div>

          <div className="order-1 xl:order-2 flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filtered.map(p => (
                <button 
                  key={p.id} 
                  onClick={() => addToCart(p)} 
                  disabled={p.quarantine || p.quality_status === "cuarentena"}
                  className={`bg-slate-800 border border-slate-700 rounded-xl p-4 text-left transition-all ${p.quarantine || p.quality_status === "cuarentena" ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-700"}`}
                >
                  <h3 className="font-medium text-white truncate">{p.name}</h3>
                  <p className="text-emerald-400 font-bold mt-1">{formatCurrency(p.price)}</p>
                  <p className="text-xs text-slate-500 mt-1">Stock: {p.stock || 0}</p>
                {p.unit && (
                  <p className="text-xs text-slate-500">Unidad: {p.unit}</p>
                )}
                  {(p.quarantine || p.quality_status === "cuarentena") && (
                    <span className="mt-2 inline-block text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300">
                      Cuarentena
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-semibold">Método de pago</h3>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta</option>
              <option value="transferencia">Transferencia</option>
            </select>
            {paymentMethod === "efectivo" && (
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  type="number"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  placeholder="Efectivo recibido"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <p className="text-xs text-slate-400">Cambio</p>
                  <p className="text-emerald-300 font-semibold">{formatCurrency(changeDue)}</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">Entrega</h3>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={isDelivery}
                  onChange={(e) => setIsDelivery(e.target.checked)}
                  className="accent-violet-600"
                />
                A domicilio
              </label>
            </div>
            {isDelivery && (
              <div className="grid gap-3">
                <select
                  value={deliveryCustomerId}
                  onChange={(e) => setDeliveryCustomerId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Seleccionar cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
                <input
                  value={deliveryNote}
                  onChange={(e) => setDeliveryNote(e.target.value)}
                  placeholder="Nota de entrega"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Evidencias (opcional)</h3>
            <button
              type="button"
              onClick={() => setShowSaleEvidence(!showSaleEvidence)}
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              {showSaleEvidence ? "Ocultar" : "Adjuntar evidencia"}
            </button>
          </div>
          {showSaleEvidence && (
            <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
              <EvidenceCapture
                context="sale"
                transactionId="sale_draft"
                required={false}
                onChange={setSaleEvidences}
                existingEvidences={saleEvidences}
              />
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold">Panel de Crédito (Fiado)</h3>
                <p className="text-xs text-slate-400">Registra ventas a crédito y pagos parciales.</p>
              </div>
              <button
                onClick={() => navigate("/credits")}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs"
              >
                Ver Cuentas por Cobrar
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={creditCustomerId}
                onChange={(e) => setCreditCustomerId(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="">Seleccionar cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>{customer.name}</option>
                ))}
              </select>
              <input
                type="number"
                value={creditCash}
                onChange={(e) => setCreditCash(e.target.value)}
                placeholder="Pago en efectivo"
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Cliente</p>
                <p className="text-white font-semibold">{selectedCustomer?.name || "Sin seleccionar"}</p>
                <p className="text-xs text-slate-500">{selectedCustomer?.phone || "-"}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Deuda actual</p>
                <p className="text-amber-300 font-semibold">{formatCurrency(selectedBalance)}</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Total venta</p>
                <p className="text-white font-semibold">{formatCurrency(creditTotal)}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Pago efectivo</p>
                <p className="text-emerald-300 font-semibold">{formatCurrency(creditCashAmount)}</p>
              </div>
              <div className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <p className="text-xs text-slate-400">Saldo pendiente</p>
                <p className="text-amber-300 font-semibold">{formatCurrency(creditBalance)}</p>
              </div>
            </div>
            <button
              onClick={processCreditSale}
              disabled={cart.length === 0}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all"
            >
              Registrar fiado
            </button>
          </div>

          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-white font-semibold">Bitácora de Créditos</h3>
                <p className="text-xs text-slate-400">Últimos registros de deudores.</p>
              </div>
              <button
                onClick={() => navigate("/credits")}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                Abrir Cuentas por Cobrar
              </button>
            </div>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {creditLog.length === 0 ? (
                <p className="text-sm text-slate-500">Sin créditos registrados.</p>
              ) : creditLog.map((entry) => (
                <div key={entry.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm font-semibold">{entry.name}</p>
                      <p className="text-xs text-slate-400">{entry.phone}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">
                        {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : "-"}
                      </span>
                      {entry.customerId && (
                        <button
                          onClick={() => navigate(`/credits?customer_id=${entry.customerId}`)}
                          className="text-xs text-violet-300 hover:text-violet-200"
                        >
                          Ver deuda
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4 text-xs text-slate-300 mt-3">
                    <div>
                      <p className="text-slate-500">Pago efectivo</p>
                      <p className="text-emerald-300">{formatCurrency(entry.cashPaid)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Deuda</p>
                      <p className="text-amber-300">{formatCurrency(entry.totalDue)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Saldo pendiente</p>
                      <p className="text-red-300">{formatCurrency(entry.balanceDue)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Saldo total</p>
                      <p className="text-slate-200">{formatCurrency(entry.customerBalance)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      {showSignatureModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-white">
                ✍️ Firma de Entrega (Opcional)
              </h3>
              <button 
                onClick={skipSignature} 
                className="text-slate-400 hover:text-white"
              >
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <p className="text-slate-400 text-sm">
                Solicita al cliente que firme para confirmar la entrega de productos.
              </p>

              <EvidenceCapture
                context="delivery"
                transactionId={pendingSaleId}
                required={false}
                onChange={setEvidences}
                existingEvidences={evidences}
              />

              <div className="flex gap-3 pt-2">
                <button
                  onClick={skipSignature}
                  className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl"
                >
                  Omitir Firma
                </button>
                <button
                  onClick={completeSaleWithSignature}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2"
                >
                  <HiOutlineCheck className="w-5 h-5" />
                  Completar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}