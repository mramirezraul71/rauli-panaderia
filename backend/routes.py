from fastapi import APIRouter
from pydantic import BaseModel
from typing import List

router = APIRouter()

# --- MODELOS DE DATOS ---
class Product(BaseModel):
    id: int
    name: str
    price: float
    category: str

class Order(BaseModel):
    id: int
    product: str
    quantity: int
    status: str

# --- DATOS DE PRUEBA (Dummy Data) ---
fake_products = [
    {"id": 1, "name": "Pan Sobao", "price": 2.50, "category": "Panadería"},
    {"id": 2, "name": "Pan de Agua", "price": 2.00, "category": "Panadería"},
    {"id": 3, "name": "Quesito", "price": 1.25, "category": "Repostería"},
    {"id": 4, "name": "Pastelillo de Guayaba", "price": 1.50, "category": "Repostería"},
]

fake_recipes = [
    {"id": 1, "name": "Receta Base Pan", "ingredients": ["Harina", "Agua", "Sal", "Levadura"]},
    {"id": 2, "name": "Relleno de Queso", "ingredients": ["Queso Crema", "Azúcar", "Vainilla"]},
]

fake_orders = []

# --- RUTAS UNIFICADAS ---
# Rutas para Productos (Soporta ambas versiones de la URL)
@router.get("/products", tags=["General"])
async def get_products_general():
    return fake_products

@router.get("/production/products", tags=["Producción"])
async def get_products_production():
    return fake_products

# Rutas para Recetas
@router.get("/production/recipes", tags=["Producción"])
async def get_recipes():
    return fake_recipes

@router.get("/production/recipes/{recipe_id}", tags=["Producción"])
async def get_recipe_detail(recipe_id: int):
    for r in fake_recipes:
        if r["id"] == recipe_id:
            return r
    return fake_recipes[0]

# Rutas para Órdenes
@router.get("/production/production-orders", tags=["Producción"])
async def get_orders():
    return fake_orders

@router.post("/production/production-orders", tags=["Producción"])
async def create_order(order: Order):
    order_data = order.model_dump() if hasattr(order, "model_dump") else order.dict()
    fake_orders.append(order_data)
    return {"message": "Orden creada", "order": order_data}
