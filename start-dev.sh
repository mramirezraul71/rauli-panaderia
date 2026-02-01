#!/bin/bash

# GENESIS - Script de Desarrollo
# Inicia backend y frontend simultáneamente

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🥖 GENESIS - Modo Desarrollo                         ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Directorio base
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Función para limpiar al salir
cleanup() {
    echo ""
    echo -e "${YELLOW}Deteniendo servidores...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Verificar dependencias del backend
echo -e "${YELLOW}Verificando dependencias del backend...${NC}"
cd "$BASE_DIR/backend"
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del backend..."
    npm install
fi

# Verificar dependencias del frontend
echo -e "${YELLOW}Verificando dependencias del frontend...${NC}"
cd "$BASE_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "Instalando dependencias del frontend..."
    npm install
fi

# Iniciar backend
echo ""
echo -e "${GREEN}Iniciando Backend (puerto 3001)...${NC}"
cd "$BASE_DIR/backend"
node server.js &
BACKEND_PID=$!

# Esperar un momento para que el backend inicie
sleep 2

# Verificar que el backend esté corriendo
if ps -p $BACKEND_PID > /dev/null; then
    echo -e "${GREEN}✓ Backend iniciado (PID: $BACKEND_PID)${NC}"
else
    echo -e "${RED}✗ Error iniciando backend${NC}"
    exit 1
fi

# Iniciar frontend
echo ""
echo -e "${GREEN}Iniciando Frontend (puerto 5173)...${NC}"
cd "$BASE_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

sleep 3

# Mostrar información
echo ""
echo "════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✓ GENESIS está listo${NC}"
echo ""
echo "  Backend API:  http://localhost:3001/api"
echo "  Frontend:     http://localhost:5173"
echo ""
echo "  Usuarios de prueba:"
echo "    - admin@rauli.com / admin123 (Administrador)"
echo "    - gerente@rauli.com / gerente123 (Gerente)"
echo "    - cajero@rauli.com / cajero123 (Cajero)"
echo ""
echo "  Presiona Ctrl+C para detener"
echo ""
echo "════════════════════════════════════════════════════════════"

# Mantener el script corriendo
wait
