#!/bin/bash

# Script para corregir fórmulas con referencias externas en Excel
# Autor: Claude Code
# Descripción: Extrae, modifica y recomprime el archivo Excel

set -e

EXCEL_FILE="./xlsx/FORMATO_GENERADOR.xlsx"
TEMP_DIR="/tmp/excel_fix_$$"
BACKUP_FILE="./xlsx/FORMATO_GENERADOR_backup_$(date +%Y%m%d_%H%M%S).xlsx"

echo "=== Script de Corrección de Fórmulas Excel ==="
echo "Archivo: $EXCEL_FILE"

# Verificar que el archivo existe
if [[ ! -f "$EXCEL_FILE" ]]; then
    echo "Error: El archivo no existe: $EXCEL_FILE"
    exit 1
fi

# Verificar dependencias
if ! command -v unzip &> /dev/null || ! command -v zip &> /dev/null; then
    echo "Error: Se requieren unzip y zip"
    echo "Instalar con: sudo apt-get install unzip zip"
    exit 1
fi

# Crear backup
echo "Creando backup..."
cp "$EXCEL_FILE" "$BACKUP_FILE"
echo "Backup creado: $BACKUP_FILE"

# Crear directorio temporal
mkdir -p "$TEMP_DIR"
cd "$TEMP_DIR"

# Extraer el archivo Excel (es un ZIP)
echo "Extrayendo archivo Excel..."
unzip -q "$(realpath "$EXCEL_FILE")"

# Función para procesar archivos XML
fix_xml_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        echo "Procesando: $file"
        
        # Reemplazar referencias externas
        sed -i 's|Informacion y levantamientos/\[FORMATO GENERADOR[^]]*\]||g' "$file"
        sed -i 's|\[FORMATO GENERADOR[^]]*\.xlsx\]||g' "$file"
        sed -i "s|'[^']*\[FORMATO GENERADOR[^']*'!|ESTIMACION!|g" "$file"
        
        echo "  ✓ Procesado"
    fi
}

# Buscar y procesar archivos de hojas de cálculo
echo "Buscando archivos de fórmulas..."
total_files=0

# Procesar archivos de worksheets
for file in xl/worksheets/*.xml; do
    if [[ -f "$file" ]]; then
        fix_xml_file "$file"
        ((total_files++))
    fi
done

# Procesar archivos de cálculos
for file in xl/calcChain.xml xl/sharedStrings.xml; do
    if [[ -f "$file" ]]; then
        fix_xml_file "$file"
        ((total_files++))
    fi
done

# Buscar otros archivos XML que puedan contener fórmulas
find . -name "*.xml" -type f | while read -r xmlfile; do
    if grep -q "FORMATO GENERADOR" "$xmlfile" 2>/dev/null; then
        echo "Encontrado en: $xmlfile"
        fix_xml_file "$xmlfile"
    fi
done

echo "Procesados $total_files archivos"

# Recomprimir el archivo Excel
echo "Recomprimiendo archivo..."
zip -r -q "$(realpath "$EXCEL_FILE")" *

# Limpiar
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "✓ Proceso completado"
echo "Backup disponible en: $BACKUP_FILE"

echo ""
echo "=== Instrucciones adicionales ==="
echo "1. Verifique que las fórmulas funcionen correctamente en Excel"
echo "2. Si todo está correcto, puede eliminar el backup"
echo "3. Reconstruya el contenedor Docker para aplicar los cambios:"
echo "   docker-compose build && docker-compose up -d"