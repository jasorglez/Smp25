#!/bin/bash

# ============================================
# Deploy Script for biapp.com.mx
# ============================================

set -e  # Exit on error

echo "🚀 Starting deployment process..."

# Variables
IMAGE_NAME="biapp-angular"
VERSION=$(grep -oP "version: '\K[^']*" src/environments/environment.ts | head -1 | cut -d' ' -f1)
CONTAINER_NAME="biapp-angular"
PORT=8080

echo "📦 Building version: $VERSION"

# Build Docker image
docker build -t $IMAGE_NAME:$VERSION -t $IMAGE_NAME:latest .

echo "🛑 Stopping existing container..."
docker stop $CONTAINER_NAME || true
docker rm $CONTAINER_NAME || true

echo "🔄 Starting new container..."
docker run -d \
  --name $CONTAINER_NAME \
  --restart unless-stopped \
  -p $PORT:80 \
  $IMAGE_NAME:latest

echo "🧹 Cleaning old images..."
docker image prune -f

echo "✅ Deployment complete!"
echo "🌐 Application running at http://localhost:$PORT"
echo "📊 Check logs: docker logs -f $CONTAINER_NAME"
