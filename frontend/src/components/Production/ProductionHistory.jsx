import React, { useState } from 'react';
import { Calendar, Package, DollarSign, Filter } from 'lucide-react';
import { formatCurrency, formatDate } from '../../config/businessConfig';

const ProductionHistory = ({ orders }) => {
  const [filterDate, setFilterDate] = useState('all'); // all, today, week, month

  const getFilteredOrders = () => {
    if (filterDate === 'all') return orders;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);

      switch (filterDate) {
        case 'today':
          return orderDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return orderDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredOrders = getFilteredOrders();

  const totalProduced = filteredOrders.reduce((sum, order) => sum + order.quantity, 0);
  const totalCost = filteredOrders.reduce((sum, order) => sum + (order.totalCost || 0), 0);
  const uniqueUnits = Array.from(new Set(filteredOrders.map(order => order.unit).filter(Boolean)));
  const unitLabel = uniqueUnits.length === 1 ? uniqueUnits[0] : 'mixto';

  const formatDateTime = (dateString) => formatDate(dateString, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (orders.length === 0) {
    return (
      <div className="empty-state">
        <Calendar size={64} />
        <h3>No hay órdenes de producción</h3>
        <p>El historial aparecerá aquí cuando produzcas algo</p>
      </div>
    );
  }

  return (
    <div className="production-history">
      <div className="history-controls">
        <div className="filter-buttons">
          <button
            className={`filter-btn ${filterDate === 'all' ? 'active' : ''}`}
            onClick={() => setFilterDate('all')}
          >
            Todas
          </button>
          <button
            className={`filter-btn ${filterDate === 'today' ? 'active' : ''}`}
            onClick={() => setFilterDate('today')}
          >
            Hoy
          </button>
          <button
            className={`filter-btn ${filterDate === 'week' ? 'active' : ''}`}
            onClick={() => setFilterDate('week')}
          >
            Esta Semana
          </button>
          <button
            className={`filter-btn ${filterDate === 'month' ? 'active' : ''}`}
            onClick={() => setFilterDate('month')}
          >
            Este Mes
          </button>
        </div>

        <div className="history-stats">
          <div className="stat-item">
            <Package size={18} />
            <div>
              <div className="stat-label">Total Producido</div>
              <div className="stat-value">{totalProduced} {unitLabel}</div>
            </div>
          </div>
          <div className="stat-item">
            <DollarSign size={18} />
            <div>
              <div className="stat-label">Costo Total</div>
              <div className="stat-value">{formatCurrency(totalCost)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="history-table">
        <table>
          <thead>
            <tr>
              <th>Fecha y Hora</th>
              <th>Tipo</th>
              <th>Referencia</th>
              <th>Cantidad</th>
              <th>Costo Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map(order => (
                <tr key={order.id}>
                  <td>
                    <div className="date-cell">
                      <Calendar size={14} />
                      {formatDateTime(order.createdAt)}
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${order.orderType || "recipe"}`}>
                      {order.orderType === 'service' ? 'Servicio'
                        : order.orderType === 'project' ? 'Proyecto'
                        : order.orderType === 'work_order' ? 'Orden'
                        : order.orderType === 'custom' ? 'Libre'
                        : 'Receta'}
                    </span>
                  </td>
                  <td>
                    <strong>{order.referenceName || order.recipeName || "Producción"}</strong>
                  </td>
                  <td>{order.quantity} {order.unit || "ud"}</td>
                  <td className="cost-cell">
                    {formatCurrency(order.totalCost)}
                  </td>
                  <td>
                    <span className={`status-badge ${order.status}`}>
                      {order.status === 'completed' ? 'Completado' : order.status}
                    </span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {filteredOrders.length === 0 && (
        <div className="no-results">
          <Filter size={48} />
          <p>No hay órdenes en este período</p>
        </div>
      )}
    </div>
  );
};

export default ProductionHistory;
