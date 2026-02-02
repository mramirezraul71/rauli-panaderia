"""
RAULI-ERP Backend - FastAPI
Puerto dinámico: Render asigna PORT. Local: 10000 por defecto.
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router

app = FastAPI(
    title="Rauli ERP Backend",
    description="Backend para el sistema de panadería Rauli",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Rauli ERP Backend API", "status": "running"}


@app.get("/health")
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "rauli-erp-backend"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=port)
