import React, { useState, useEffect } from 'react';
import { Package, Plus, Calendar, TrendingUp, History, Camera, X, Check } from 'lucide-react';
import RecipeEditor from './RecipeEditor';
import RecipeList from './RecipeList';
import ProductionOrder from './ProductionOrder';
import ProductionHistory from './ProductionHistory';
import EvidenceCapture from '../Evidence/EvidenceCapture';
import sentinelService, { ALERT_TYPES } from '../../services/SentinelService';
import { db } from '../../services/dataService';
import './Production.css';

const ProductionModule = () => {
  const [activeTab, setActiveTab] = useState('recipes'); // recipes, produce, history
  const [recipes, setRecipes] = useState([]);
  const [products, setProducts] = useState([]);
  const [productionOrders, setProductionOrders] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Evidence states
  const [evidences, setEvidences] = useState([]);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [pendingProduction, setPendingProduction] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar recetas
      const recipesRes = await fetch('http://localhost:3001/api/production/recipes');
      const recipesData = await recipesRes.json();
      setRecipes(recipesData);

      // Cargar productos (inventario)
      const productsRes = await fetch('http://localhost:3001/api/products');
      const productsData = await productsRes.json();
      setProducts(productsData);

      // Cargar órdenes de producción
      const ordersRes = await fetch('http://localhost:5000/api/production/production-orders');
      const ordersData = await ordersRes.json();
      setProductionOrders(ordersData);

    } catch (error) {
      console.error('Error al cargar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecipe = () => {
    setSelectedRecipe(null);
    setShowEditor(true);
  };

  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setShowEditor(true);
  };

  const handleSaveRecipe = async (recipeData) => {
    try {
      const url = selectedRecipe
        ? `http://localhost:3001/api/production/recipes/${selectedRecipe.id}`
        : 'http://localhost:3001/api/production/recipes';

      const method = selectedRecipe ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recipeData)
      });

      if (!response.ok) throw new Error('Error al guardar receta');

      alert('Receta guardada exitosamente');
      setShowEditor(false);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar la receta');
    }
  };

  const handleDeleteRecipe = async (recipeId) => {
    if (!window.confirm('¿Eliminar esta receta?')) return;

    try {
      const response = await fetch(
        `http://localhost:3001/api/production/recipes/${recipeId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Error al eliminar');

      alert('Receta eliminada');
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar la receta');
    }
  };

  const handleProduce = async (orderType, referenceId, quantity, meta = {}) => {
    // Store production data and show evidence modal
    setPendingProduction({ orderType, referenceId, quantity, meta });
    setShowEvidenceModal(true);
  };

  const completeProduce = async () => {
    if (!pendingProduction) return;
    let evidenceThreshold = 50;
    try {
      const thresholdSetting = await db.settings?.get("production_evidence_threshold");
      if (thresholdSetting?.value) {
        evidenceThreshold = Number(thresholdSetting.value);
      }
    } catch {}
    if (pendingProduction.quantity >= evidenceThreshold && evidences.length === 0) {
      sentinelService.addAlert(
        ALERT_TYPES.PRODUCTION_EVIDENCE_MISSING,
        'Producción sin evidencia requerida',
        {
          reference_type: 'production',
          reference_id: pendingProduction.recipeId,
          quantity: pendingProduction.quantity,
          evidence_required: true
        }
      );
      alert('Se requiere evidencia para producciones altas.');
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/production/production-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: pendingProduction.orderType || "recipe",
          recipeId: pendingProduction.orderType === "recipe" ? pendingProduction.referenceId : undefined,
          referenceName: pendingProduction.meta?.referenceName,
          quantity: pendingProduction.quantity,
          productionDate: pendingProduction.meta?.productionDate,
          unit: pendingProduction.meta?.unit,
          costCenter: pendingProduction.meta?.costCenter,
          projectOrClient: pendingProduction.meta?.projectOrClient,
          priority: pendingProduction.meta?.priority,
          dueDate: pendingProduction.meta?.dueDate,
          notes: pendingProduction.meta?.notes,
          evidences: evidences
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.missing) {
          let message = 'Stock insuficiente:\n\n';
          data.missing.forEach(item => {
            message += `${item.name}: Necesitas ${item.required}, tienes ${item.available}\n`;
          });
          alert(message);
        } else {
          throw new Error(data.error || 'Error en la producción');
        }
        return;
      }

      alert('¡Producción completada exitosamente!');
      
      // Reset states
      setEvidences([]);
      setShowEvidenceModal(false);
      setPendingProduction(null);
      
      loadData();
      setActiveTab('history');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar la producción');
    }
  };

  const skipEvidence = () => {
    // Complete production without evidence
    completeProduce();
  };

  if (loading) {
    return (
      <div className="production-module">
        <div className="loading-state">
          <Package size={48} className="spin" />
          <p>Cargando módulo de producción...</p>
        </div>
      </div>
    );
  }

  if (showEditor) {
    return (
      <div className="production-module">
        <RecipeEditor
          recipe={selectedRecipe}
          products={products}
          onSave={handleSaveRecipe}
          onCancel={() => setShowEditor(false)}
        />
      </div>
    );
  }

  const enrichOrders = () => {
    if (!productionOrders?.length) return [];
    return productionOrders.map((order) => {
      const orderType = order.orderType || "recipe";
      const recipe = orderType === "recipe" ? recipes.find((r) => r.id === order.recipeId) : null;
      const referenceName = order.referenceName || recipe?.productName || recipe?.name || "Producción";
      const unit = order.unit || recipe?.unit || "ud";
      const productionDate = order.productionDate || order.createdAt;
      return { ...order, orderType, referenceName, unit, productionDate };
    });
  };

  const enrichedOrders = enrichOrders();

  return (
    <div className="production-module">
      <div className="production-header">
        <div className="header-title">
          <Package size={32} />
          <div>
            <h1>Producción y Recetas</h1>
            <p>Gestiona tus fichas técnicas y órdenes de producción</p>
          </div>
        </div>

        <div className="header-stats">
          <div className="stat-card">
            <div className="stat-label">Recetas Activas</div>
            <div className="stat-value">{recipes.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Producción Hoy</div>
            <div className="stat-value">
              {enrichedOrders.filter(o => {
                const today = new Date().toISOString().split('T')[0];
                return (o.productionDate || o.createdAt).startsWith(today);
              }).length}
            </div>
          </div>
        </div>
      </div>

      <div className="production-tabs">
        <button
          className={`tab ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          <Package size={18} />
          Recetas
        </button>
        <button
          className={`tab ${activeTab === 'produce' ? 'active' : ''}`}
          onClick={() => setActiveTab('produce')}
        >
          <Calendar size={18} />
          Producir
        </button>
        <button
          className={`tab ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <History size={18} />
          Historial
        </button>
      </div>

      <div className="production-content">
        {activeTab === 'recipes' && (
          <>
            <div className="content-header">
              <h2>Fichas Técnicas</h2>
              <button className="btn-primary" onClick={handleCreateRecipe}>
                <Plus size={18} />
                Nueva Receta
              </button>
            </div>
            <RecipeList
              recipes={recipes}
              onEdit={handleEditRecipe}
              onDelete={handleDeleteRecipe}
            />
          </>
        )}

        {activeTab === 'produce' && (
          <>
            <div className="content-header">
              <h2>Crear Orden de Producción</h2>
            </div>
            <ProductionOrder
              recipes={recipes}
              products={products}
              onProduce={handleProduce}
            />
          </>
        )}

        {activeTab === 'history' && (
          <>
            <div className="content-header">
              <h2>Historial de Producción</h2>
            </div>
            <ProductionHistory orders={enrichedOrders} />
          </>
        )}
      </div>

      {/* Evidence Modal */}
      {showEvidenceModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'sticky',
              top: 0,
              backgroundColor: '#1e293b',
              zIndex: 1
            }}>
              <h3 style={{
                color: 'white',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Camera size={20} style={{ color: '#a78bfa' }} />
                Evidencia de Producción (Opcional)
              </h3>
              <button
                onClick={() => {
                  setShowEvidenceModal(false);
                  setPendingProduction(null);
                  setEvidences([]);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px' }}>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '16px' }}>
                Puedes adjuntar fotos del proceso de producción, producto terminado, o cualquier evidencia relevante.
              </p>

              <EvidenceCapture
                context="production"
                transactionId={pendingProduction?.recipeId || 'NEW'}
                required={false}
                onChange={setEvidences}
                existingEvidences={evidences}
              />

              <div style={{
                display: 'flex',
                gap: '12px',
                marginTop: '24px'
              }}>
                <button
                  onClick={skipEvidence}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#334155',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Omitir Evidencia
                </button>
                <button
                  onClick={completeProduce}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#a78bfa',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <Check size={18} />
                  Completar Producción
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionModule;