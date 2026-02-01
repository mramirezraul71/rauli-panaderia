import React, { useState } from 'react';
import { Edit, Trash2, Clock, DollarSign, TrendingUp, Package } from 'lucide-react';
import { formatCurrency } from '../../config/businessConfig';

const RecipeList = ({ recipes, onEdit, onDelete }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredRecipes = recipes.filter(recipe =>
    recipe.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getProfitColor = (margin) => {
    if (margin >= 30) return '#10b981';
    if (margin >= 15) return '#f59e0b';
    return '#ef4444';
  };

  if (recipes.length === 0) {
    return (
      <div className="empty-state">
        <Package size={64} />
        <h3>No hay recetas creadas</h3>
        <p>Crea tu primera ficha técnica para comenzar</p>
      </div>
    );
  }

  return (
    <div className="recipe-list">
      <div className="list-controls">
        <input
          type="text"
          placeholder="Buscar receta..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="recipes-grid">
        {filteredRecipes.map(recipe => {
          const profitMargin = recipe.costPerUnit > 0
            ? (((recipe.suggestedPrice - recipe.costPerUnit) / recipe.costPerUnit) * 100)
            : 0;

          return (
            <div key={recipe.id} className="recipe-card">
              <div className="recipe-card-header">
                <h3>{recipe.productName}</h3>
                <div className="recipe-actions">
                  <button
                    className="btn-icon"
                    onClick={() => onEdit(recipe)}
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="btn-icon-danger"
                    onClick={() => onDelete(recipe.id)}
                    title="Eliminar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="recipe-card-body">
                <div className="recipe-info">
                  <div className="info-item">
                    <Package size={16} />
                    <span>Rinde: {recipe.yield} {recipe.unit}</span>
                  </div>
                  <div className="info-item">
                    <Clock size={16} />
                    <span>{recipe.prepTime} min</span>
                  </div>
                </div>

                <div className="recipe-ingredients">
                  <strong>Ingredientes ({recipe.ingredients.length}):</strong>
                  <ul>
                    {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                      <li key={idx}>
                        {ing.ingredientName} - {ing.quantity} {ing.unit}
                      </li>
                    ))}
                    {recipe.ingredients.length > 3 && (
                      <li className="more">+{recipe.ingredients.length - 3} más</li>
                    )}
                  </ul>
                </div>

                <div className="recipe-costs">
                  <div className="cost-item">
                    <span className="cost-label">Costo:</span>
                    <span className="cost-value">{formatCurrency(recipe.costPerUnit)}</span>
                  </div>
                  <div className="cost-item">
                    <span className="cost-label">Precio Sugerido:</span>
                    <span className="cost-value highlight">
                      {formatCurrency(recipe.suggestedPrice)}
                    </span>
                  </div>
                  <div className="cost-item">
                    <TrendingUp
                      size={16}
                      style={{ color: getProfitColor(profitMargin) }}
                    />
                    <span
                      className="cost-value"
                      style={{ color: getProfitColor(profitMargin) }}
                    >
                      {profitMargin.toFixed(1)}% margen
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecipeList;
