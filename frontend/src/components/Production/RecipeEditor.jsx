import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, Calculator, Package,
  ChevronDown, ChevronUp, DollarSign, TrendingUp
} from 'lucide-react';
import { formatCurrency } from '../../config/businessConfig';

const RecipeEditor = ({ recipe, products, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    productId: '',
    productName: '',
    yield: 1,
    unit: 'unidad',
    ingredients: [],
    instructions: '',
    prepTime: 0,
    margin: 30
  });

  const [showCostAnalysis, setShowCostAnalysis] = useState(false);
  const [costData, setCostData] = useState({
    totalCost: 0,
    costPerUnit: 0,
    suggestedPrice: 0,
    profit: 0,
    profitMargin: 0
  });

  useEffect(() => {
    if (recipe) {
      setFormData(recipe);
      calculateCosts(recipe);
    }
  }, [recipe]);

  const calculateCosts = (data) => {
    const totalCost = data.ingredients.reduce((sum, ing) => {
      return sum + (ing.quantity * ing.cost);
    }, 0);

    const costPerUnit = data.yield > 0 ? totalCost / data.yield : 0;
    const suggestedPrice = costPerUnit * (1 + data.margin / 100);
    const profit = suggestedPrice - costPerUnit;
    const profitMargin = costPerUnit > 0 ? ((profit / costPerUnit) * 100) : 0;

    setCostData({
      totalCost,
      costPerUnit,
      suggestedPrice,
      profit,
      profitMargin
    });
  };

  const handleAddIngredient = () => {
    const newIngredient = {
      ingredientId: '',
      ingredientName: '',
      quantity: 0,
      unit: 'kg',
      cost: 0
    };

    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, newIngredient]
    }));
  };

  const handleIngredientChange = (index, field, value) => {
    const updated = [...formData.ingredients];
    updated[index][field] = value;

    if (field === 'ingredientId') {
      const product = products.find(p => p.id === value);
      if (product) {
        updated[index].ingredientName = product.name;
        updated[index].cost = product.price || 0;
        updated[index].unit = product.unit || 'kg';
      }
    }

    setFormData(prev => ({ ...prev, ingredients: updated }));
    calculateCosts({ ...formData, ingredients: updated });
  };

  const handleRemoveIngredient = (index) => {
    const updated = formData.ingredients.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, ingredients: updated }));
    calculateCosts({ ...formData, ingredients: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.productName) {
      alert('Debes ingresar el nombre del producto');
      return;
    }

    if (formData.ingredients.length === 0) {
      alert('Debes agregar al menos un ingrediente');
      return;
    }

    const dataToSave = {
      ...formData,
      costPerUnit: costData.costPerUnit,
      suggestedPrice: costData.suggestedPrice
    };

    onSave(dataToSave);
  };

  const getProfitColor = () => {
    if (costData.profitMargin >= 30) return '#10b981';
    if (costData.profitMargin >= 15) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="recipe-editor">
      <form onSubmit={handleSubmit}>
        <div className="recipe-header">
          <h2>{recipe ? 'Editar Receta' : 'Nueva Receta'}</h2>
          <div className="header-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onCancel}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              <Save size={18} />
              Guardar Receta
            </button>
          </div>
        </div>

        <div className="recipe-section">
          <h3>📋 Información Básica</h3>
          
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre del Producto *</label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productName: e.target.value
                }))}
                placeholder="Ej: Pastel de Chocolate"
                required
              />
            </div>

            <div className="form-group">
              <label>Producto Final (Inventario)</label>
              <select
                value={formData.productId}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  productId: e.target.value
                }))}
              >
                <option value="">Seleccionar producto...</option>
                {products
                  .filter(p => p.type === 'producto')
                  .map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="form-group">
              <label>Rendimiento *</label>
              <input
                type="number"
                value={formData.yield}
                onChange={(e) => {
                  const newData = {
                    ...formData,
                    yield: parseFloat(e.target.value) || 1
                  };
                  setFormData(newData);
                  calculateCosts(newData);
                }}
                min="0.1"
                step="0.1"
                required
              />
            </div>

            <div className="form-group">
              <label>Unidad</label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  unit: e.target.value
                }))}
              >
                <option value="unidad">Unidad</option>
                <option value="kg">Kilogramo</option>
                <option value="litro">Litro</option>
                <option value="docena">Docena</option>
              </select>
            </div>

            <div className="form-group">
              <label>Tiempo de Preparación (min)</label>
              <input
                type="number"
                value={formData.prepTime}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  prepTime: parseInt(e.target.value) || 0
                }))}
                min="0"
              />
            </div>

            <div className="form-group">
              <label>Margen Deseado (%)</label>
              <input
                type="number"
                value={formData.margin}
                onChange={(e) => {
                  const newData = {
                    ...formData,
                    margin: parseFloat(e.target.value) || 30
                  };
                  setFormData(newData);
                  calculateCosts(newData);
                }}
                min="0"
                step="1"
              />
            </div>
          </div>
        </div>

        <div className="recipe-section">
          <div className="section-header">
            <h3>🥘 Ingredientes</h3>
            <button
              type="button"
              className="btn-add"
              onClick={handleAddIngredient}
            >
              <Plus size={18} />
              Agregar Ingrediente
            </button>
          </div>

          {formData.ingredients.length === 0 ? (
            <div className="empty-state">
              <Package size={48} />
              <p>No hay ingredientes. Haz clic en "Agregar Ingrediente"</p>
            </div>
          ) : (
            <div className="ingredients-table">
              <table>
                <thead>
                  <tr>
                    <th>Ingrediente</th>
                    <th>Cantidad</th>
                    <th>Unidad</th>
                    <th>Costo Unit.</th>
                    <th>Costo Total</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {formData.ingredients.map((ing, index) => (
                    <tr key={index}>
                      <td>
                        <select
                          value={ing.ingredientId}
                          onChange={(e) => handleIngredientChange(
                            index,
                            'ingredientId',
                            e.target.value
                          )}
                          required
                        >
                          <option value="">Seleccionar...</option>
                          {products
                            .filter(p => p.type === 'insumo')
                            .map(p => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="number"
                          value={ing.quantity}
                          onChange={(e) => handleIngredientChange(
                            index,
                            'quantity',
                            parseFloat(e.target.value) || 0
                          )}
                          min="0"
                          step="0.01"
                          required
                        />
                      </td>
                      <td>
                        <select
                          value={ing.unit}
                          onChange={(e) => handleIngredientChange(
                            index,
                            'unit',
                            e.target.value
                          )}
                        >
                          <option value="kg">Kg</option>
                          <option value="litro">Litro</option>
                          <option value="unidad">Unidad</option>
                          <option value="gr">Gramos</option>
                          <option value="ml">ML</option>
                        </select>
                      </td>
                      <td>
                        {formatCurrency(ing.cost)}
                      </td>
                      <td>
                        <strong>{formatCurrency(ing.quantity * ing.cost)}</strong>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-icon-danger"
                          onClick={() => handleRemoveIngredient(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="recipe-section">
          <h3>📝 Instrucciones de Preparación</h3>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              instructions: e.target.value
            }))}
            rows="6"
            placeholder="Describe los pasos de preparación..."
          />
        </div>

        <div className="recipe-section">
          <div
            className="section-header clickable"
            onClick={() => setShowCostAnalysis(!showCostAnalysis)}
          >
            <h3>
              <Calculator size={20} />
              Análisis de Costos
            </h3>
            {showCostAnalysis ? <ChevronUp /> : <ChevronDown />}
          </div>

          {showCostAnalysis && (
            <div className="cost-analysis">
              <div className="cost-grid">
                <div className="cost-card">
                  <div className="cost-label">Costo Total de Producción</div>
                  <div className="cost-value">
                    {formatCurrency(costData.totalCost)}
                  </div>
                </div>

                <div className="cost-card">
                  <div className="cost-label">Costo por Unidad</div>
                  <div className="cost-value">
                    {formatCurrency(costData.costPerUnit)}
                  </div>
                </div>

                <div className="cost-card">
                  <div className="cost-label">Precio Sugerido</div>
                  <div className="cost-value highlight">
                    {formatCurrency(costData.suggestedPrice)}
                  </div>
                </div>

                <div className="cost-card">
                  <div className="cost-label">Ganancia por Unidad</div>
                  <div className="cost-value" style={{ color: getProfitColor() }}>
                    {formatCurrency(costData.profit)}
                  </div>
                </div>
              </div>

              <div className="profit-indicator">
                <TrendingUp size={24} style={{ color: getProfitColor() }} />
                <div>
                  <div className="profit-label">Margen de Ganancia</div>
                  <div
                    className="profit-value"
                    style={{ color: getProfitColor() }}
                  >
                    {costData.profitMargin.toFixed(1)}%
                  </div>
                </div>
              </div>

              {costData.profitMargin < 15 && (
                <div className="alert alert-warning">
                  ⚠️ El margen de ganancia es bajo. Considera ajustar el precio de venta o reducir costos.
                </div>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default RecipeEditor;
