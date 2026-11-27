#!/bin/bash
set -e

VENV_DIR="$HOME/.venvs/codex-skills"
SKILLS_DIR="$HOME/.codex/skills"
VALIDATOR="$SKILLS_DIR/.system/skill-creator/scripts/quick_validate.py"

echo "Preparando un entorno aislado para validar las Agent Skills..."
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install PyYAML

for skill in ag-grid-cell-focus angular-crud-standard angular-release-record; do
  echo "Validando $skill..."
  "$VENV_DIR/bin/python" "$VALIDATOR" "$SKILLS_DIR/$skill"
done

echo ""
echo "Instalación y validación completadas."
read -r -p "Presiona Enter para cerrar esta ventana. "
