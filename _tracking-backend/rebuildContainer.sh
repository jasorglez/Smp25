#!/bin/bash

# Definir variables
MAIN_DIR="$HOME/main"  # Cambia esta ruta si el directorio "main" está en otro lugar
REPO_DIR="$MAIN_DIR/tu-repositorio"  # Ajusta el nombre del repositorio
GIT_PASSWORD="Qpzm1984"

clear
echo ""
echo "-------------------------------------------------------------------------------"
echo "Iniciado recomposición de contenedor de MicroServicio Tracking (Administration)"
echo "-------------------------------------------------------------------------------"
echo ""

# Ir al directorio principal
echo "Cambiando al directorio: $MAIN_DIR"
#cd "$MAIN_DIR" || { echo "Error: No se pudo acceder a $MAIN_DIR"; exit 1; }

# Ir al directorio del repositorio
echo "Cambiando al directorio del repositorio: $REPO_DIR"
#cd "$REPO_DIR" || { echo "Error: No se pudo acceder a $REPO_DIR"; exit 1; }

# Bajar cambios del repositorio
echo ""
echo "Obteniendo cambios desde GitHub..."
echo "$GIT_PASSWORD" | git pull 2>&1 | tee git_pull.log

# Bajar el contenedor
echo ""
echo "Deteniendo y eliminando contenedor Docker..."
docker-compose down

# Descargar nuevamente los cambios
echo ""
echo "Actualizando código fuente..."
#echo "$GIT_PASSWORD" | git pull 2>&1 | tee git_pull.log

# Reconstruir y recompilar aplicación
echo ""
echo "Construyendo contenedor..."
docker-compose build --no-cache

# Subir contenedor y demonizar
echo ""
echo "Iniciando contenedor en modo demonio..."
docker-compose up -d

# Mensaje final
echo ""
echo "Despliegue completado."
echo "---------------------------------------"
echo ""
docker ps
