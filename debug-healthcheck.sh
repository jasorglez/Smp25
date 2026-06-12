#!/bin/bash

echo "=== DIAGNÓSTICO CONTENEDOR ANGULAR ==="
echo ""

echo "📋 Logs del contenedor:"
docker logs --tail 50 biapp-angular

echo ""
echo "🔍 Estado del health check:"
docker inspect --format='{{json .State.Health}}' biapp-angular | jq

echo ""
echo "🌐 Probando conexión HTTP directa:"
docker exec biapp-angular wget -O- http://localhost/ 2>&1 | head -n 20

echo ""
echo "📊 Procesos dentro del contenedor:"
docker exec biapp-angular ps aux

echo ""
echo "🔧 Test manual del health check:"
docker exec biapp-angular wget --quiet --tries=1 --spider http://localhost/ && echo "✅ OK" || echo "❌ FAILED"
