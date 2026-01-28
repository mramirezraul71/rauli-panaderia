import React, { useState } from 'react';
import { Play, AlertCircle, Package, TrendingUp, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../../config/businessConfig';

const ProductionOrder = ({ recipes, products, onProduce }) => {
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [orderType, setOrderType] = useState('recipe'); // recipe | service | project | work_order | custom
  const [referenceName, setReferenceName] = useState('');
  const [unitOverride, setUnitOverride] = useState('');
  const [costCenter, setCostCenter] = useState('');
  const [projectOrClient, setProjectOrClient] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [productionDate, setProductionDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [productionNotes, setProductionNotes] = useState("");
  const [stockWarnings, setStockWarnings] = useState([]);

  const currentRecipe = recipes.find(r => r.id === selectedRecipe);

  const checkStock = () => {
    if (!currentRecipe) return;

    const warnings = [];

    currentRecipe.ingredients.forEach(ingredient => {
      const product = products.find(p => p.id === ingredient.ingredientId);
      const requiredQty = ingredient.quantity * quantity;

      if (!product) {
        warnings.push({
          name: ingredient.ingredientName,
          status: 'missing',
          message: 'Producto no encontrado en inventario'
        });
      } else if (product.stock < requiredQty) {
        warnings.push({
          name: ingredient.ingredientName,
          status: 'insufficient',
          required: requiredQty,
          available: product.stock,
          missing: requiredQty - product.stock
        });
      }
    });

    setStockWarnings(warnings);
    return warnings.length === 0;
  };

  const handleRecipeChange = (recipeId) => {
    setSelectedRecipe(recipeId);
    setStockWarnings([]);
  };

  const handleQuantityChange = (value) => {
    const qty = parseInt(value) || 1;
    setQuantity(qty > 0 ? qty : 1);
    setStockWarnings([]);
  };

  const resolveUnitLabel = () => {
    if (orderType === "recipe") return currentRecipe?.unit || "ud";
    return unitOverride || "unidad";
  };

  const handleProduce = () => {
    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    if (orderType === "recipe") {
      if (!currentRecipe) {
        alert('Selecciona una receta');
        return;
      }
      if (checkStock()) {
        const unitLabel = resolveUnitLabel();
        const nameLabel = currentRecipe.productName || currentRecipe.name || "Receta";
        if (window.confirm(`¿Registrar producción del ${productionDate} por ${quantity} ${unitLabel} de ${nameLabel}?`)) {
          onProduce("recipe", selectedRecipe, quantity, {
            productionDate,
            unit: unitLabel,
            referenceName: nameLabel,
            costCenter,
            projectOrClient,
            priority,
            dueDate,
            notes: productionNotes
          });
          setSelectedRecipe('');
          setQuantity(1);
          setStockWarnings([]);
          setProductionNotes("");
        }
      }
      return;
    }

    if (!referenceName.trim()) {
      alert('Indica el nombre de la producción/servicio');
      return;
    }

    const unitLabel = resolveUnitLabel();
    if (window.confirm(`¿Registrar producción del ${productionDate} por ${quantity} ${unitLabel} de ${referenceName}?`)) {
      onProduce(orderType, referenceName.trim(), quantity, {
        productionDate,
        unit: unitLabel,
        referenceName: referenceName.trim(),
        costCenter,
        projectOrClient,
        priority,
        dueDate,
        notes: productionNotes
      });
      setReferenceName("");
      setUnitOverride("");
      setQuantity(1);
      setProductionNotes("");
    }
  };

  return (
    <div className="production-order">
      <div className="order-form">
        <div className="production-guidance">
          <h3>Registro de producción del día</h3>
          <p>
            Selecciona el tipo de producción. Las recetas son una opción, pero también puedes registrar
            servicios, proyectos o producciones libres.
          </p>
        </div>
        <div className="form-section">
          <h3>Tipo de Producción</h3>
          <div className="order-type-grid">
            {[
              { id: "recipe", label: "Receta", desc: "Con insumos y costos" },
              { id: "service", label: "Servicio", desc: "Servicios o trabajos" },
              { id: "project", label: "Proyecto", desc: "Por contrato o proyecto" },
              { id: "work_order", label: "Orden de trabajo", desc: "Tareas internas" },
              { id: "custom", label: "Producción libre", desc: "Manual sin receta" }
            ].map((type) => (
              <button
                type="button"
                key={type.id}
                className={`order-type-card ${orderType === type.id ? "active" : ""}`}
                onClick={() => {
                  setOrderType(type.id);
                  setSelectedRecipe('');
                  setStockWarnings([]);
                }}
              >
                <strong>{type.label}</strong>
                <span>{type.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {currentRecipe && (
          <>
            <div className="form-section">
              <h3>Cantidad a Producir</h3>
              <div className="quantity-input">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  min="1"
                  step="1"
                />
                <span className="unit-label">{currentRecipe.unit || "ud"}</span>
              </div>
            </div>

            <div className="form-section">
              <h3>Detalle de Producción</h3>
              <div className="meta-grid">
                <div className="meta-field">
                  <label>Fecha de producción</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                  />
                </div>
                <div className="meta-field">
                  <label>Unidad de medida</label>
                  <div className="unit-pill">{currentRecipe.unit || "Unidad"}</div>
                </div>
                <div className="meta-field">
                  <label>Centro de costo</label>
                  <input
                    type="text"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    placeholder="Ej: Operaciones, Taller"
                  />
                </div>
                <div className="meta-field">
                  <label>Proyecto / Cliente</label>
                  <input
                    type="text"
                    value={projectOrClient}
                    onChange={(e) => setProjectOrClient(e.target.value)}
                    placeholder="Ej: Proyecto A, Cliente XYZ"
                  />
                </div>
                <div className="meta-field">
                  <label>Prioridad</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="meta-field">
                  <label>Fecha compromiso</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="meta-field full">
                  <label>Notas (turno, lote, observaciones)</label>
                  <textarea
                    rows="2"
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    placeholder="Ej: Turno mañana, lote #A12, ajustes de proceso"
                  />
                </div>
              </div>
            </div>

            <div className="recipe-details">
              <h3>Detalles de la Receta</h3>
              
              <div className="details-grid">
                <div className="detail-card">
                  <div className="detail-label">Ingredientes Necesarios</div>
                  <div className="detail-value">{currentRecipe.ingredients.length}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Costo por Unidad</div>
                  <div className="detail-value">{formatCurrency(currentRecipe.costPerUnit)}</div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Costo Total</div>
                  <div className="detail-value highlight">
                    {formatCurrency(currentRecipe.costPerUnit * quantity)}
                  </div>
                </div>
                <div className="detail-card">
                  <div className="detail-label">Valor Producción</div>
                  <div className="detail-value success">
                    {formatCurrency(currentRecipe.suggestedPrice * quantity)}
                  </div>
                </div>
              </div>

              <div className="ingredients-list">
                <h4>Ingredientes Requeridos:</h4>
                <table className="ingredients-table">
                  <thead>
                    <tr>
                      <th>Ingrediente</th>
                      <th>Necesario</th>
                      <th>Disponible</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRecipe.ingredients.map((ing, idx) => {
                      const product = products.find(p => p.id === ing.ingredientId);
                      const required = ing.quantity * quantity;
                      const available = product ? product.stock : 0;
                      const hasStock = available >= required;

                      return (
                        <tr key={idx} className={!hasStock ? 'warning-row' : ''}>
                          <td>{ing.ingredientName}</td>
                          <td>{required.toFixed(2)} {ing.unit}</td>
                          <td>{available.toFixed(2)} {ing.unit}</td>
                          <td>
                            {hasStock ? (
                              <span className="status-ok">
                                <CheckCircle size={16} />
                                OK
                              </span>
                            ) : (
                              <span className="status-warning">
                                <AlertCircle size={16} />
                                Insuficiente
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {stockWarnings.length > 0 && (
              <div className="stock-warnings">
                <div className="warning-header">
                  <AlertCircle size={24} />
                  <h4>Advertencias de Stock</h4>
                </div>
                <ul>
                  {stockWarnings.map((warning, idx) => (
                    <li key={idx}>
                      <strong>{warning.name}:</strong>{' '}
                      {warning.status === 'missing'
                        ? warning.message
                        : `Necesitas ${warning.required.toFixed(2)}, tienes ${warning.available.toFixed(2)} (faltan ${warning.missing.toFixed(2)})`
                      }
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="action-buttons">
              <button
                className="btn-primary btn-produce"
                onClick={handleProduce}
              >
                <Play size={20} />
                Iniciar Producción
              </button>
            </div>
          </>
        )}

        {orderType === "recipe" && !currentRecipe && (
          <div className="empty-state">
            <Package size={64} />
            <p>Selecciona una receta para comenzar</p>
          </div>
        )}

        {orderType !== "recipe" && (
          <>
            <div className="form-section">
              <h3>Detalle de la Producción</h3>
              <div className="meta-grid">
                <div className="meta-field full">
                  <label>Nombre del producto/servicio</label>
                  <input
                    type="text"
                    value={referenceName}
                    onChange={(e) => setReferenceName(e.target.value)}
                    placeholder="Ej: Servicio de mantenimiento, Paquete A"
                  />
                </div>
                <div className="meta-field">
                  <label>Unidad de medida</label>
                  <input
                    type="text"
                    value={unitOverride}
                    onChange={(e) => setUnitOverride(e.target.value)}
                    placeholder="Ej: horas, piezas, unidades"
                  />
                </div>
                <div className="meta-field">
                  <label>Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                  />
                </div>
                <div className="meta-field">
                  <label>Fecha de producción</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                  />
                </div>
                <div className="meta-field">
                  <label>Centro de costo</label>
                  <input
                    type="text"
                    value={costCenter}
                    onChange={(e) => setCostCenter(e.target.value)}
                    placeholder="Ej: Operaciones, Taller"
                  />
                </div>
                <div className="meta-field">
                  <label>Proyecto / Cliente</label>
                  <input
                    type="text"
                    value={projectOrClient}
                    onChange={(e) => setProjectOrClient(e.target.value)}
                    placeholder="Ej: Proyecto A, Cliente XYZ"
                  />
                </div>
                <div className="meta-field">
                  <label>Prioridad</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
                <div className="meta-field">
                  <label>Fecha compromiso</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="meta-field full">
                  <label>Notas (turno, lote, observaciones)</label>
                  <textarea
                    rows="2"
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    placeholder="Ej: Turno noche, lote #B22, observaciones"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductionOrder;
