from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router
import uvicorn

app = FastAPI(
    title="Rauli ERP Backend",
    description="Backend para el sistema de panadería Rauli",
    version="1.0.0"
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas
app.include_router(router, prefix="/api")

@app.get("/")
async def root():
    return {"message": "Rauli ERP Backend API", "status": "running"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "rauli-erp-backend"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
