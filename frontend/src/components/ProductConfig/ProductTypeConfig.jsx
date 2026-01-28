import React, { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import './ProductTypeConfig.css';
import { products as productsApi } from '../../services/api';

const ProductTypeConfig = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await productsApi.list({ active: '1' });
      const list = response?.data?.products || response?.data || [];
      setProducts(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('Error al cargar productos:', error);
      setMessage({ type: 'error', text: 'Error al cargar productos' });
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (productId, newType) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === productId ? { ...product, type: newType } : product
      )
    );
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const updatePromises = products.map(product =>
        productsApi.update(product.id, { type: product.type || null })
      );
      await Promise.all(updatePromises);
      setMessage({ type: 'success', text: 'Configuracion guardada exitosamente' });
      setTimeout(() => { loadProducts(); }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Error al guardar' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (<div className="config-loading"><Loader size={48} /><p>Cargando...</p></div>);

  return (<div className="product-type-config"><div className="config-header"><button onClick={handleSaveAll} disabled={saving}>{saving ? 'Guardando...' : 'Guardar Todo'}</button></div>{message && <div className={`message ${message.type}`}>{message.text}</div>}<div className="products-table"><table><thead><tr><th>Producto</th><th>Tipo</th></tr></thead><tbody>{products.map(p => <tr key={p.id}><td>{p.name}</td><td><select value={p.type || ''} onChange={e => handleTypeChange(p.id, e.target.value)}><option value="">Seleccionar</option><option value="insumo">Insumo</option><option value="producto">Producto</option></select></td></tr>)}</tbody></table></div></div>);
};

export default ProductTypeConfig;
