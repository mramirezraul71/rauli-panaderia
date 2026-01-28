/**
 * GENESIS - Bitácora de Créditos (Fiados)
 * Gestión de ventas a crédito y liquidaciones
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, CustomersDB } from '../services/dataService';
import { CURRENCY_SYMBOL, formatCurrency } from '../config/businessConfig';
import toast from 'react-hot-toast';
import {
  HiOutlineUserGroup,
  HiOutlinePlus,
  HiOutlineCash,
  HiOutlineDocumentText,
  HiOutlineSearch,
  HiOutlineX,
  HiOutlineCheck,
  HiOutlinePhone,
  HiOutlineMail,
  HiOutlineExclamation,
  HiOutlineTrash,
  HiOutlineClipboardList
} from 'react-icons/hi';

export default function CreditLog() {
  const [activeTab, setActiveTab] = useState('customers');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Formulario de nuevo cliente
  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    email: '',
    credit_limit: 5000,
    notes: ''
  });

  // ==================== DATOS EN VIVO ====================
  
  // Clientes
  const customers = useLiveQuery(async () => {
    const custs = await db.customers?.where('active').equals(1).toArray() || [];
    return custs.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, []) || [];

  // Ventas a crédito pendientes
  const creditSales = useLiveQuery(async () => {
    return await db.sales
      ?.filter(s => s.payment_status === 'pending' || s.payment_method === 'credit')
      .toArray() || [];
  }, []) || [];

  // Historial de pagos (de transacciones)
  const paymentHistory = useLiveQuery(async () => {
    return await db.transactions
      ?.filter(t => t.type === 'credit_payment')
      .reverse()
      .limit(50)
      .toArray() || [];
  }, []) || [];

  // ==================== CÁLCULOS ====================

  const totalPending = customers.reduce((sum, c) => sum + (c.balance || 0), 0);
  const customersWithDebt = customers.filter(c => (c.balance || 0) > 0);

  // Filtrar clientes
  const filteredCustomers = customers.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  // ==================== HANDLERS ====================

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    setLoading(true);
    try {
      await CustomersDB.create({
        ...newCustomer,
        credit_limit: parseFloat(newCustomer.credit_limit) || 5000
      });
      toast.success('Cliente creado');
      setShowCustomerModal(false);
      setNewCustomer({ name: '', phone: '', email: '', credit_limit: 5000, notes: '' });
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;

    const amount = parseFloat(paymentAmount);
    if (amount <= 0) {
      toast.error('Monto inválido');
      return;
    }

    setLoading(true);
    try {
      // Reducir balance del cliente
      await db.customers.where('id').equals(selectedCustomer.id).modify(c => {
        c.balance = Math.max(0, (c.balance || 0) - amount);
      });

      // Registrar transacción
      await db.transactions.add({
        type: 'credit_payment',
        amount: amount,
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        description: paymentNote || `Abono de ${selectedCustomer.name}`,
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      });

      toast.success(`Pago de ${formatCurrency(amount)} registrado`);
      setShowPaymentModal(false);
      setSelectedCustomer(null);
      setPaymentAmount('');
      setPaymentNote('');
    } catch (err) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const handleDeleteCustomer = async (customer) => {
    if ((customer.balance || 0) > 0) {
      toast.error('No se puede eliminar cliente con saldo pendiente');
      return;
    }
    if (!confirm(`¿Eliminar a ${customer.name}?`)) return;

    try {
      await db.customers.update(customer.id, { active: 0 });
      toast.success('Cliente eliminado');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // ==================== TABS ====================

  const tabs = [
    { id: 'customers', label: 'Clientes', icon: HiOutlineUserGroup },
    { id: 'pending', label: 'Deudas Pendientes', icon: HiOutlineExclamation },
    { id: 'history', label: 'Historial de Pagos', icon: HiOutlineClipboardList }
  ];

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Bitácora de Créditos</h1>
          <p className="text-slate-400">Gestión de ventas a crédito y cobranza</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCustomerModal(true)}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total por Cobrar</p>
              <p className="text-2xl font-bold text-red-400">{formatCurrency(totalPending)}</p>
            </div>
            <div className="p-3 bg-red-500/20 rounded-lg">
              <HiOutlineCash className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Clientes con Deuda</p>
              <p className="text-2xl font-bold text-yellow-400">{customersWithDebt.length}</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <HiOutlineUserGroup className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Total Clientes</p>
              <p className="text-2xl font-bold text-blue-400">{customers.length}</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <HiOutlineDocumentText className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ==================== TAB: CLIENTES ==================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Búsqueda */}
          <div className="relative">
            <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-slate-400 focus:border-purple-500 outline-none"
            />
          </div>

          {/* Lista de clientes */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Cliente</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Contacto</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Límite</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Saldo</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id} className="hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {customer.name?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-white font-medium">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {customer.phone && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <HiOutlinePhone className="w-4 h-4" />
                              {customer.phone}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-slate-400">
                              <HiOutlineMail className="w-4 h-4" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {formatCurrency(customer.credit_limit)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${(customer.balance || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {formatCurrency(customer.balance)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {(customer.balance || 0) > 0 && (
                            <button
                              onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                              className="p-2 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400"
                              title="Registrar pago"
                            >
                              <HiOutlineCash className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteCustomer(customer)}
                            disabled={(customer.balance || 0) > 0}
                            className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 disabled:opacity-30"
                            title="Eliminar"
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

            {filteredCustomers.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <HiOutlineUserGroup className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay clientes registrados</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: DEUDAS PENDIENTES ==================== */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {customersWithDebt.length > 0 ? (
            <div className="grid gap-4">
              {customersWithDebt.map(customer => (
                <div 
                  key={customer.id}
                  className="bg-slate-800 border border-red-500/30 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {customer.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">{customer.name}</h3>
                        {customer.phone && (
                          <p className="text-sm text-slate-400">{customer.phone}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-400">
                        {formatCurrency(customer.balance)}
                      </p>
                      <p className="text-xs text-slate-400">pendiente</p>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => { setSelectedCustomer(customer); setShowPaymentModal(true); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                      <HiOutlineCash className="w-5 h-5" />
                      Registrar Abono
                    </button>
                    <button
                      onClick={() => { 
                        setSelectedCustomer(customer); 
                        setPaymentAmount(customer.balance?.toString());
                        setShowPaymentModal(true); 
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2"
                    >
                      <HiOutlineCheck className="w-5 h-5" />
                      Liquidar Todo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-slate-800 border border-green-500/30 rounded-xl p-12 text-center">
              <HiOutlineCheck className="w-16 h-16 mx-auto text-green-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">¡Sin Deudas Pendientes!</h3>
              <p className="text-slate-400">Todos los clientes están al corriente</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: HISTORIAL DE PAGOS ==================== */}
      {activeTab === 'history' && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
          {paymentHistory.length > 0 ? (
            <div className="divide-y divide-slate-700">
              {paymentHistory.map(payment => (
                <div key={payment.id} className="p-4 hover:bg-slate-700/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-green-500/20 rounded-lg">
                        <HiOutlineCash className="w-6 h-6 text-green-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{payment.customer_name}</p>
                        <p className="text-sm text-slate-400">{payment.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-400">+{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-slate-400">{formatDate(payment.date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <HiOutlineClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No hay pagos registrados</p>
            </div>
          )}
        </div>
      )}

      {/* ==================== MODAL: NUEVO CLIENTE ==================== */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-slate-700/50 border-b border-slate-700 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineUserGroup className="w-5 h-5 text-purple-400" />
                Nuevo Cliente
              </h3>
              <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  required
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Teléfono</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Límite de Crédito</label>
                <input
                  type="number"
                  value={newCustomer.credit_limit}
                  onChange={(e) => setNewCustomer({ ...newCustomer, credit_limit: e.target.value })}
                  step="100"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notas</label>
                <textarea
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-purple-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : 'Crear Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: REGISTRAR PAGO ==================== */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md overflow-hidden">
            <div className="p-4 bg-green-500/10 border-b border-green-500/30 flex items-center justify-between">
              <h3 className="font-medium text-white flex items-center gap-2">
                <HiOutlineCash className="w-5 h-5 text-green-400" />
                Registrar Abono
              </h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white">
                <HiOutlineX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-4 space-y-4">
              {/* Info del cliente */}
              <div className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold">
                      {selectedCustomer.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white">{selectedCustomer.name}</p>
                    <p className="text-sm text-red-400">
                      Debe: {formatCurrency(selectedCustomer.balance)}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Monto del Abono *</label>
                <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">{CURRENCY_SYMBOL}</span>
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    step="0.01"
                    max={selectedCustomer.balance}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-4 py-3 text-white text-lg focus:border-green-500 outline-none"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 200, 500].map(amount => (
                    <button
                      key={amount}
                      type="button"
                      onClick={() => setPaymentAmount(Math.min(amount, selectedCustomer.balance).toString())}
                      className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-1 rounded text-sm"
                    >
                      {formatCurrency(amount)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(selectedCustomer.balance?.toString())}
                    className="flex-1 bg-green-600/30 hover:bg-green-600/50 text-green-400 py-1 rounded text-sm"
                  >
                    Todo
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Nota (opcional)</label>
                <input
                  type="text"
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  placeholder="Ej: Pago en efectivo"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-green-500 outline-none"
                />
              </div>

              {/* Resumen */}
              {paymentAmount && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Saldo actual:</span>
                    <span className="text-white">{formatCurrency(selectedCustomer.balance)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Abono:</span>
                    <span className="text-green-400">-{formatCurrency(parseFloat(paymentAmount) || 0)}</span>
                  </div>
                  <div className="flex justify-between font-bold pt-2 border-t border-green-500/30 mt-2">
                    <span className="text-white">Nuevo saldo:</span>
                    <span className={`${selectedCustomer.balance - (parseFloat(paymentAmount) || 0) <= 0 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {formatCurrency(Math.max(0, selectedCustomer.balance - (parseFloat(paymentAmount) || 0)))}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !paymentAmount || parseFloat(paymentAmount) <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? 'Procesando...' : (
                    <>
                      <HiOutlineCheck className="w-5 h-5" />
                      Confirmar Abono
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
