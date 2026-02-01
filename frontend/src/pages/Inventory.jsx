/**
 * GENESIS - Inventory Management Page
 * Gestión de lotes, movimientos, recetas y producción
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  HiOutlineArchive, HiOutlinePlus, HiOutlineRefresh, HiOutlineExclamation,
  HiOutlineTruck, HiOutlineAdjustments, HiOutlineClipboardList, HiOutlineCube,
  HiOutlineBeaker, HiOutlineClock, HiOutlineX, HiOutlineCheck,
  HiOutlinePencil, HiOutlineTrash
} from 'react-icons/hi';
import { inventory, products } from '../services/api';
import { formatCurrency, formatDate } from '../config/businessConfig';
import { t } from "../i18n";
import { db } from '../services/dataService';
import EvidenceCapture from '../components/Evidence/EvidenceCapture';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import { useCommandCenter } from "../context/CommandCenterContext";

const TABS = [
  { id: 'summary', label: 'Resumen', icon: HiOutlineArchive },
  { id: 'lots', label: 'Lotes', icon: HiOutlineCube },
  { id: 'movements', label: 'Movimientos', icon: HiOutlineTruck },
  { id: 'recipes', label: 'Recetas', icon: HiOutlineBeaker },
  { id: 'production', label: 'Producción', icon: HiOutlineClipboardList },
];

export default function Inventory() {
  const navigate = useNavigate();
  const location = useLocation();
  const getTabFromSearch = (search) => {
    const tabParam = new URLSearchParams(search).get('tab');
    return tabParam && TABS.some((tab) => tab.id === tabParam) ? tabParam : null;
  };
  const activeTab = getTabFromSearch(location.search) || 'summary';
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [lots, setLots] = useState([]);
  const [expiringLots, setExpiringLots] = useState([]);
  const [movements, setMovements] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [productsList, setProductsList] = useState([]);
  
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showLotModal, setShowLotModal] = useState(false);
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [editingLot, setEditingLot] = useState(null);
  const apiBlockedRef = useRef(false);
  
  const [lotFilter, setLotFilter] = useState({ product_id: '', status: 'active' });
  const [movementFilter, setMovementFilter] = useState({ type: '', limit: 50 });
  const { on } = useCommandCenter();

  const setTab = (nextTab) => {
    const params = new URLSearchParams(location.search);
    if (nextTab === 'summary') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };

  useEffect(() => { loadData(); }, []);


  useEffect(() => {
    if (activeTab === 'lots') loadLots();
    if (activeTab === 'movements') loadMovements();
    if (activeTab === 'recipes') loadRecipes();
    if (activeTab === 'production') loadProduction();
  }, [activeTab, lotFilter, movementFilter]);

  useEffect(() => {
    const unsubscribers = [
      on("OPEN_INVENTORY_ADJUSTMENT_MODAL", () => setShowAdjustmentModal(true)),
      on("OPEN_INVENTORY_LOT_MODAL", () => {
        setEditingLot(null);
        setShowLotModal(true);
      }),
      on("OPEN_INVENTORY_PRODUCTION_MODAL", () => setShowProductionModal(true))
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [on]);

  const shouldCallApi = () => {
    if (apiBlockedRef.current) return false;
    const token = localStorage.getItem('token');
    if (!token) {
      apiBlockedRef.current = true;
      console.warn('Inventario: token no disponible, se omiten llamadas API.');
      return false;
    }
    return true;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (!shouldCallApi()) {
        setSummary(null);
        setExpiringLots([]);
        setProductsList(await db.products?.toArray() || []);
        return;
      }
      const [summaryRes, expiringRes, productsRes] = await Promise.allSettled([
        inventory.summary(),
        inventory.expiringLots(7),
        products.list({ active: '1' })
      ]);

      if (summaryRes.status === 'fulfilled') {
        setSummary(summaryRes.value.data.summary);
      } else {
        console.error('Error loading inventory summary:', summaryRes.reason);
      }

      if (expiringRes.status === 'fulfilled') {
        setExpiringLots(expiringRes.value.data.lots || []);
      } else {
        console.error('Error loading expiring lots:', expiringRes.reason);
      }

      if (productsRes.status === 'fulfilled') {
        setProductsList(productsRes.value.data.products || []);
      } else {
        console.error('Error loading products list:', productsRes.reason);
        try {
          const localProducts = await db.products?.toArray();
          if (localProducts?.length) {
            setProductsList(localProducts);
          }
        } catch (localErr) {
          console.error('Error loading local products fallback:', localErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadLots = async () => {
    try {
      if (!shouldCallApi()) return;
      const res = await inventory.lots(lotFilter);
      setLots(res.data.lots || []);
    } catch (err) {
      if (err?.status === 401) apiBlockedRef.current = true;
      console.error('Error loading lots:', err);
    }
  };

  const loadMovements = async () => {
    try {
      if (!shouldCallApi()) return;
      const res = await inventory.movements(movementFilter);
      setMovements(res.data.movements || []);
    } catch (err) {
      if (err?.status === 401) apiBlockedRef.current = true;
      console.error('Error loading movements:', err);
    }
  };

  const loadRecipes = async () => {
    try {
      if (!shouldCallApi()) return;
      const res = await inventory.recipes();
      setRecipes(res.data.recipes || []);
    } catch (err) {
      if (err?.status === 401) apiBlockedRef.current = true;
      console.error('Error loading recipes:', err);
    }
  };

  const loadProduction = async () => {
    try {
      if (!shouldCallApi()) return;
      const res = await inventory.production({});
      setProductionOrders(res.data.orders || []);
    } catch (err) {
      if (err?.status === 401) apiBlockedRef.current = true;
      console.error('Error loading production:', err);
    }
  };

  const formatDateLabel = (date) => formatDate(date, { day: '2-digit', month: 'short', year: 'numeric' });
  const formatCurrencyLabel = (amount, currency) => formatCurrency(amount, currency);

  const getProductById = (productId) => {
    if (productId === undefined || productId === null) return undefined;
    const targetId = String(productId);
    return productsList.find(p => String(p.id) === targetId);
  };

  const getLotUnit = (lot, product) => {
    const unit = lot?.unit || lot?.product_unit || lot?.uom || product?.unit || product?.product_unit || product?.uom;
    return unit && String(unit).trim() ? unit : '-';
  };

  const getLotCurrency = (lot, product) => {
    const currency = lot?.currency || product?.currency || summary?.currency || 'DOP';
    return currency && String(currency).trim() ? currency : 'DOP';
  };

  const getMovementTypeLabel = (type) => {
    const types = {
      'entrada': { label: 'Entrada', color: 'text-green-400' },
      'venta': { label: 'Venta', color: 'text-blue-400' },
      'merma': { label: 'Merma', color: 'text-red-400' },
      'ajuste': { label: 'Ajuste', color: 'text-yellow-400' },
      'produccion': { label: 'Producción', color: 'text-purple-400' },
    };
    return types[type] || { label: type, color: 'text-slate-400' };
  };

  const getStatusBadge = (status) => {
    const styles = {
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'in_progress': 'bg-blue-500/20 text-blue-400',
      'completed': 'bg-green-500/20 text-green-400',
      'active': 'bg-green-500/20 text-green-400',
      'depleted': 'bg-slate-500/20 text-slate-400',
      'expired': 'bg-red-500/20 text-red-400',
    };
    return styles[status] || 'bg-slate-500/20 text-slate-400';
  };

  const completeProduction = async (orderId) => {
    if (!confirm('¿Completar esta orden de producción?')) return;
    try {
      await inventory.completeProduction(orderId, {});
      loadProduction();
      loadData();
    } catch (err) {
      alert('Error al completar: ' + err.message);
    }
  };

  const handleEditLot = (lot) => {
    setEditingLot(lot);
    setShowLotModal(true);
  };

  const handleDeleteLot = async (lot) => {
    if (!confirm('¿Eliminar este lote? Esta acción no se puede deshacer.')) return;
    let deleted = false;
    try {
      if (inventory.deleteLot) {
        await inventory.deleteLot(lot.id);
        deleted = true;
      }
    } catch (err) {
      console.warn('Delete lot failed, attempting fallback update:', err);
    }

    if (!deleted) {
      try {
        await inventory.updateLot(lot.id, { status: 'depleted', quantity: 0, deleted_at: new Date().toISOString() });
      } catch (err) {
        alert('Error al eliminar lote: ' + (err.data?.message || err.message));
        return;
      }
    }

    loadData();
    loadLots();
  };

  // ==================== TAB COMPONENTS ====================
  const SummaryTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Productos" value={summary?.total_products || 0} icon={HiOutlineCube} color="blue" />
        <StatCard title="Stock Bajo" value={summary?.low_stock_count || 0} icon={HiOutlineExclamation} color="yellow" alert={summary?.low_stock_count > 0} />
        <StatCard title="Por Vencer" value={expiringLots.length} icon={HiOutlineClock} color="red" alert={expiringLots.length > 0} />
        <StatCard title="Valor Total" value={formatCurrencyLabel(summary?.total_value)} icon={HiOutlineArchive} color="green" isLarge />
        <StatCard title="Producción Pendiente" value={summary?.pending_production || 0} icon={HiOutlineClipboardList} color="purple" />
      </div>

      {expiringLots.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <HiOutlineExclamation className="w-6 h-6 text-red-400" />
            <h3 className="font-semibold text-red-400">Productos próximos a vencer (7 días)</h3>
          </div>
          <div className="grid gap-2">
            {expiringLots.slice(0, 5).map(lot => (
              <div key={lot.id} className="flex justify-between items-center bg-slate-800/50 rounded-lg p-3">
                <div>
                  <span className="font-medium text-white">{lot.product_name}</span>
                  <span className="text-slate-400 ml-2">Lote: {lot.batch_number || lot.id.slice(0, 8)}</span>
                </div>
                <div className="text-right">
                  <span className="text-red-400 font-medium">{formatDateLabel(lot.expiration_date)}</span>
                  <span className="text-slate-400 ml-3">Cant: {lot.quantity}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-4">Movimientos Recientes</h3>
        <div className="space-y-2">
          {(summary?.recent_movements || []).slice(0, 8).map(mov => {
            const typeInfo = getMovementTypeLabel(mov.movement_type);
            return (
              <div key={mov.id} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color} bg-slate-700/50`}>{typeInfo.label}</span>
                  <span className="text-white">{mov.product_name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-medium ${mov.quantity > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {mov.quantity > 0 ? '+' : ''}{mov.quantity}
                  </span>
                  <span className="text-slate-500 text-sm">{formatDateLabel(mov.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const LotsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-3">
          <select value={lotFilter.product_id} onChange={e => setLotFilter({ ...lotFilter, product_id: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="">Todos los productos</option>
            {productsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={lotFilter.status} onChange={e => setLotFilter({ ...lotFilter, status: e.target.value })}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
            <option value="active">Activos</option>
            <option value="depleted">Agotados</option>
            <option value="expired">Vencidos</option>
            <option value="all">Todos</option>
          </select>
        </div>
        <button onClick={() => { setEditingLot(null); setShowLotModal(true); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors">
          <HiOutlinePlus className="w-5 h-5" />Nuevo Lote
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Producto</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Lote</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Cantidad</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Unidad</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Costo Unit.</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Moneda</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Vencimiento</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lots.map(lot => {
              const product = getProductById(lot.product_id);
              const unit = getLotUnit(lot, product);
              const currency = getLotCurrency(lot, product);
              const productName = lot.product_name || product?.name || 'Producto';
              const currentQty = lot.quantity ?? 0;
              const initialQty = lot.initial_quantity ?? 0;
              return (
              <tr key={lot.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-white font-medium">{productName}</td>
                <td className="px-4 py-3 text-slate-300 font-mono text-sm">{lot.batch_number || lot.id.slice(0, 8)}</td>
                <td className="px-4 py-3 text-right text-white">{currentQty} / {initialQty}</td>
                <td className="px-4 py-3 text-center text-slate-300">{unit}</td>
                <td className="px-4 py-3 text-right text-slate-300">{formatCurrencyLabel(lot.cost_per_unit, currency)}</td>
                <td className="px-4 py-3 text-center text-slate-300">{currency}</td>
                <td className="px-4 py-3 text-center">
                  <span className={lot.expiration_date && new Date(lot.expiration_date) < new Date(Date.now() + 7*24*60*60*1000) ? 'text-red-400' : 'text-slate-300'}>
                    {formatDateLabel(lot.expiration_date)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lot.status)}`}>{lot.status}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEditLot(lot)} className="text-indigo-400 hover:text-indigo-300 p-1" title="Editar">
                    <HiOutlinePencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => navigate(`/quality?product_id=${lot.product_id}&source=lot&lot_id=${lot.id}`)}
                    className="text-emerald-400 hover:text-emerald-300 p-1"
                    title="Inspeccionar"
                  >
                    <HiOutlineCheck className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDeleteLot(lot)} className="text-red-400 hover:text-red-300 p-1" title="Eliminar">
                    <HiOutlineTrash className="w-5 h-5" />
                  </button>
                </td>
              </tr>
              );
            })}
            {lots.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay lotes registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const MovementsTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <select value={movementFilter.type} onChange={e => setMovementFilter({ ...movementFilter, type: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white">
          <option value="">Todos los tipos</option>
          <option value="entrada">Entradas</option>
          <option value="venta">Ventas</option>
          <option value="merma">Mermas</option>
          <option value="ajuste">Ajustes</option>
          <option value="produccion">Producción</option>
        </select>
        <button onClick={() => setShowAdjustmentModal(true)}
          className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors">
          <HiOutlineAdjustments className="w-5 h-5" />Ajuste de Stock
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Tipo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Producto</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Cantidad</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Stock Nuevo</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Notas</th>
            </tr>
          </thead>
          <tbody>
            {movements.map(mov => {
              const typeInfo = getMovementTypeLabel(mov.movement_type);
              return (
                <tr key={mov.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-300 text-sm">{formatDateLabel(mov.created_at)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color} bg-slate-700/50`}>{typeInfo.label}</span></td>
                  <td className="px-4 py-3 text-white font-medium">{mov.product_name}</td>
                  <td className={`px-4 py-3 text-right font-medium ${mov.movement_type === 'entrada' ? 'text-green-400' : 'text-red-400'}`}>
                    {mov.movement_type === 'entrada' ? '+' : '-'}{mov.quantity}
                  </td>
                  <td className="px-4 py-3 text-right text-white">{mov.new_stock}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm max-w-xs truncate">{mov.notes || '-'}</td>
                </tr>
              );
            })}
            {movements.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No hay movimientos registrados</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  const RecipesTab = () => (
    <div className="space-y-4">
      <p className="text-slate-400">Recetas de producción para transformar materias primas en productos terminados</p>
      <div className="grid gap-4">
        {recipes.map(recipe => (
          <div key={recipe.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{recipe.name}</h3>
                <p className="text-slate-400">Produce: {recipe.product_name} ({recipe.yield_quantity} {recipe.product_unit})</p>
              </div>
              {recipe.prep_time_minutes && (
                <span className="flex items-center gap-1 text-slate-400"><HiOutlineClock className="w-4 h-4" />{recipe.prep_time_minutes} min</span>
              )}
            </div>
            <div className="border-t border-slate-700/50 pt-3">
              <h4 className="text-sm font-medium text-slate-300 mb-2">Ingredientes:</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {recipe.ingredients?.map((ing, idx) => (
                  <div key={idx} className="flex justify-between bg-slate-700/30 rounded px-3 py-2 text-sm">
                    <span className="text-white">{ing.ingredient_name}</span>
                    <span className="text-slate-400">{ing.quantity} {ing.unit || ing.ingredient_unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
        {recipes.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
            <HiOutlineBeaker className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No hay recetas registradas</p>
          </div>
        )}
      </div>
    </div>
  );

  const ProductionTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-slate-400">Órdenes de producción para transformar inventario</p>
        <button onClick={() => setShowProductionModal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
          <HiOutlinePlus className="w-5 h-5" />Nueva Orden
        </button>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Receta</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Producto</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Cantidad</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Estado</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productionOrders.map(order => (
              <tr key={order.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-slate-300 text-sm">{formatDateLabel(order.created_at)}</td>
                <td className="px-4 py-3 text-white">{order.recipe_name}</td>
                <td className="px-4 py-3 text-slate-300">{order.product_name}</td>
                <td className="px-4 py-3 text-right text-white">{order.quantity_produced || order.quantity_to_produce} / {order.quantity_to_produce}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>{order.status}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  {order.status !== 'completed' && (
                    <button onClick={() => completeProduction(order.id)} className="text-green-400 hover:text-green-300 p-1" title="Completar">
                      <HiOutlineCheck className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/quality?product_id=${order.product_id}&source=production&order_id=${order.id}`)}
                    className="text-emerald-400 hover:text-emerald-300 p-1"
                    title="Inspeccionar"
                  >
                    <HiOutlineCheck className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {productionOrders.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No hay órdenes de producción</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==================== MODALS ====================
  const AdjustmentModal = () => {
    const [form, setForm] = useState({ product_id: '', quantity: 0, type: 'ajuste', notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const [evidences, setEvidences] = useState([]);
    const [evidenceThreshold, setEvidenceThreshold] = useState(10);
    useEffect(() => {
      const loadThreshold = async () => {
        try {
          const thresholdSetting = await db.settings?.get("inventory_evidence_threshold");
          if (thresholdSetting?.value) {
            setEvidenceThreshold(Number(thresholdSetting.value));
          }
        } catch {}
      };
      loadThreshold();
    }, []);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        if (Math.abs(form.quantity) >= evidenceThreshold && evidences.length === 0) {
          sentinelService.addAlert(
            ALERT_TYPES.INVENTORY_EVIDENCE_MISSING,
            'Ajuste de inventario sin evidencia',
            {
              reference_type: 'inventory_adjustment',
              reference_id: form.product_id,
              quantity: form.quantity,
              evidence_required: true
            }
          );
          alert('Se requiere evidencia para ajustes mayores.');
          setSubmitting(false);
          return;
        }
        await inventory.adjustment({ product_id: form.product_id, quantity: form.type === 'merma' ? -Math.abs(form.quantity) : form.quantity, type: form.type, notes: form.notes });
        setShowAdjustmentModal(false);
        setEvidences([]);
        loadData(); loadMovements();
      } catch (err) { alert('Error: ' + err.message); }
      finally { setSubmitting(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Ajuste de Inventario</h3>
            <button onClick={() => setShowAdjustmentModal(false)} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Producto</label>
              <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required>
                <option value="">Seleccionar producto...</option>
                {productsList.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de ajuste</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white">
                <option value="ajuste">Ajuste (+ o -)</option>
                <option value="merma">Merma (solo resta)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad</label>
              <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Notas</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" rows={2} placeholder="Razón del ajuste..." />
            </div>
            <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3">
              <EvidenceCapture
                context="inventory"
                transactionId={form.product_id}
                required={Math.abs(form.quantity) >= evidenceThreshold}
                onChange={setEvidences}
              />
              <p className="text-xs text-slate-400 mt-2">
                Evidencia requerida si el ajuste es mayor o igual a {evidenceThreshold}.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAdjustmentModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg disabled:opacity-50">{submitting ? 'Guardando...' : 'Aplicar'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const LotModal = () => {
    const defaultLotForm = { product_id: '', batch_number: '', quantity: 0, cost_per_unit: 0, expiration_date: '', supplier: '', notes: '' };
    const [form, setForm] = useState(defaultLotForm);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
      if (editingLot) {
        setForm({
          product_id: editingLot.product_id || '',
          batch_number: editingLot.batch_number || '',
          quantity: editingLot.quantity || 0,
          cost_per_unit: editingLot.cost_per_unit || 0,
          expiration_date: editingLot.expiration_date ? editingLot.expiration_date.slice(0, 10) : '',
          supplier: editingLot.supplier || '',
          notes: editingLot.notes || ''
        });
      } else {
        setForm(defaultLotForm);
      }
    }, [editingLot, showLotModal]);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        if (editingLot) {
          await inventory.updateLot(editingLot.id, form);
        } else {
          await inventory.createLot(form);
        }
        setShowLotModal(false);
        setEditingLot(null);
        loadData(); loadLots();
      } catch (err) { alert('Error: ' + err.message); }
      finally { setSubmitting(false); }
    };
    const handleClose = () => {
      setShowLotModal(false);
      setEditingLot(null);
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">{editingLot ? 'Editar Lote' : 'Entrada de Inventario (Nuevo Lote)'}</h3>
            <button onClick={handleClose} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Producto *</label>
              <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required>
                <option value="">Seleccionar producto...</option>
                {productsList.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad *</label>
                <input type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" min="0.01" step="0.01" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Costo Unitario</label>
                <input type="number" value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" min="0" step="0.01" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Número de Lote</label>
                <input type="text" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" placeholder="LOT-2024-001" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Fecha Vencimiento</label>
                <input type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Proveedor</label>
              <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={handleClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg disabled:opacity-50">{submitting ? 'Guardando...' : (editingLot ? 'Actualizar' : 'Registrar')}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ProductionModal = () => {
    const [form, setForm] = useState({ recipe_id: '', quantity_to_produce: 1, notes: '' });
    const [submitting, setSubmitting] = useState(false);
    const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await inventory.createProduction(form);
        setShowProductionModal(false);
        loadProduction();
      } catch (err) { alert('Error: ' + (err.data?.message || err.message)); }
      finally { setSubmitting(false); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
          <div className="flex justify-between items-center p-4 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-white">Nueva Orden de Producción</h3>
            <button onClick={() => setShowProductionModal(false)} className="text-slate-400 hover:text-white"><HiOutlineX className="w-6 h-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Receta *</label>
              <select value={form.recipe_id} onChange={e => setForm({ ...form, recipe_id: e.target.value })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" required>
                <option value="">Seleccionar receta...</option>
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name} → {r.product_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Cantidad a Producir *</label>
              <input type="number" value={form.quantity_to_produce} onChange={e => setForm({ ...form, quantity_to_produce: parseInt(e.target.value) || 1 })} className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white" min="1" required />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowProductionModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg">Cancelar</button>
              <button type="submit" disabled={submitting} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg disabled:opacity-50">{submitting ? 'Creando...' : 'Crear Orden'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // ==================== RENDER ====================
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.inventory", "Inventario")}</h1>
          <p className="text-slate-400">Gestión de lotes, movimientos y producción</p>
        </div>
        <button type="button" onClick={loadData} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <HiOutlineRefresh className="w-5 h-5" />Actualizar
        </button>
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            <tab.icon className="w-5 h-5" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'summary' && <SummaryTab />}
      {activeTab === 'lots' && <LotsTab />}
      {activeTab === 'movements' && <MovementsTab />}
      {activeTab === 'recipes' && <RecipesTab />}
      {activeTab === 'production' && <ProductionTab />}

      {showAdjustmentModal && <AdjustmentModal />}
      {showLotModal && <LotModal />}
      {showProductionModal && <ProductionModal />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, isLarge, alert }) {
  const colorClasses = { blue: 'bg-blue-500/20 text-blue-400', green: 'bg-green-500/20 text-green-400', yellow: 'bg-yellow-500/20 text-yellow-400', red: 'bg-red-500/20 text-red-400', purple: 'bg-purple-500/20 text-purple-400' };
  return (
    <div className={`bg-slate-800/50 border rounded-xl p-4 ${alert ? 'border-yellow-500/50' : 'border-slate-700/50'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}><Icon className="w-5 h-5" /></div>
      </div>
      <p className={`font-bold ${isLarge ? 'text-xl' : 'text-2xl'} text-white`}>{value}</p>
    </div>
  );
}
