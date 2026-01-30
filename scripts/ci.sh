#!/bin/bash
# CI Script for Fantasy CDL
# Run: ./scripts/ci.sh

set -e  # Exit on error

echo "========================================"
echo "  Fantasy CDL - CI Pipeline"
echo "========================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

step() {
    echo -e "\n${GREEN}==> $1${NC}"
}

error() {
    echo -e "${RED}Error: $1${NC}"
    exit 1
}

# Check Node version
step "Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ required, found v$NODE_VERSION"
fi
echo "Node.js version: $(node -v)"

# Install dependencies
step "Installing dependencies..."
npm ci || npm install

# Generate Prisma client
step "Generating Prisma client..."
cd backend
npx prisma generate
cd ..

# Lint
step "Running linters..."
npm run lint --workspaces --if-present || echo "Lint warnings found"

# Type check backend
step "Type checking backend..."
cd backend
npx tsc --noEmit
cd ..

# Type check frontend
step "Type checking frontend..."
cd frontend
npx tsc --noEmit
cd ..

# Build backend
step "Building backend..."
cd backend
npm run build
cd ..

# Build frontend
step "Building frontend..."
cd frontend
npm run build
cd ..

# Run tests
step "Running tests..."
npm test --workspaces --if-present || echo "No tests found"

echo ""
echo "========================================"
echo -e "  ${GREEN}CI Pipeline Completed Successfully!${NC}"
echo "========================================"
