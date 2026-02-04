#!/bin/bash
# ============================================
# Deploy Script for biapp.com.mx
# ============================================
set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Navegar al directorio del proyecto
cd /bi/repos/Smp25

# Variables
VERSION=$(grep -oP "version: '\K[^']*" src/environments/environment.ts | head -1 | cut -d' ' -f1 || echo "unknown")

echo "📦 Building version: $VERSION"

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Stop existing containers
echo "🛑 Stopping containers..."
docker compose down

# Build new image
echo "🔨 Building new image..."
docker compose build --no-cache

# Start containers
echo "🚀 Starting containers..."
docker compose up -d

# Wait for container to be healthy
echo "⏳ Waiting for container to be ready..."
sleep 5

# Clean old images
echo "🧹 Cleaning old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "🌐 Application running at http://localhost:8080"
echo "📊 Container status:"
docker compose ps
echo ""
echo "📋 Recent logs:"
docker compose logs --tail=20
