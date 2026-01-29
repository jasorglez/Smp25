#!/usr/bin/env node
/**
 * Script de configuración de Git Hooks
 * Funciona en Windows y Linux/macOS
 *
 * Uso: npm run setup-hooks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT_DIR = path.join(__dirname, '..');
const HOOKS_DIR = path.join(ROOT_DIR, '.git', 'hooks');
const ENV_DIR = path.join(ROOT_DIR, 'src', 'environments');

// Contenido del hook post-checkout
const POST_CHECKOUT_HOOK = `#!/bin/bash
# Git hook post-checkout: Cambia automáticamente el environment según la rama
# Generado por: npm run setup-hooks

# Obtener la rama actual
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Directorio de environments
ENV_DIR="src/environments"

# Archivo destino
TARGET="$ENV_DIR/environment.ts"

echo "🔄 Detectada rama: $BRANCH"

case "$BRANCH" in
    main|master)
        SOURCE="$ENV_DIR/environment.production.ts"
        ENV_NAME="PRODUCCIÓN"
        ;;
    develop|development)
        SOURCE="$ENV_DIR/environment.development.ts"
        ENV_NAME="DESARROLLO"
        ;;
    *)
        # Para otras ramas (features, hotfixes, etc), usar development por defecto
        SOURCE="$ENV_DIR/environment.development.ts"
        ENV_NAME="DESARROLLO (rama: $BRANCH)"
        ;;
esac

# Verificar que el archivo fuente existe
if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$TARGET"
    echo "✅ Environment cambiado a: $ENV_NAME"
    echo "   Archivo copiado: $SOURCE -> $TARGET"
else
    echo "⚠️  Archivo no encontrado: $SOURCE"
    echo "   El environment.ts no fue modificado"
fi
`;

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function main() {
  log('\n📦 Configurando Git Hooks para el proyecto...\n', 'cyan');

  // 1. Verificar que estamos en un repositorio Git
  if (!fs.existsSync(path.join(ROOT_DIR, '.git'))) {
    log('❌ Error: No se encontró el directorio .git', 'red');
    log('   Asegúrate de estar en la raíz del proyecto.', 'yellow');
    process.exit(1);
  }

  // 2. Crear directorio de hooks si no existe
  if (!fs.existsSync(HOOKS_DIR)) {
    fs.mkdirSync(HOOKS_DIR, { recursive: true });
    log('📁 Directorio de hooks creado', 'green');
  }

  // 3. Crear el hook post-checkout
  const hookPath = path.join(HOOKS_DIR, 'post-checkout');

  // Escribir con saltos de línea Unix (LF) para compatibilidad
  fs.writeFileSync(hookPath, POST_CHECKOUT_HOOK.replace(/\r\n/g, '\n'), { mode: 0o755 });
  log('✅ Hook post-checkout instalado', 'green');

  // 4. En sistemas Unix, asegurar permisos de ejecución
  if (os.platform() !== 'win32') {
    try {
      fs.chmodSync(hookPath, 0o755);
      log('✅ Permisos de ejecución configurados', 'green');
    } catch (err) {
      log('⚠️  No se pudieron configurar permisos (puede requerir sudo)', 'yellow');
    }
  }

  // 5. Verificar archivos de environment
  const envFiles = ['environment.production.ts', 'environment.development.ts'];
  let missingFiles = [];

  envFiles.forEach(file => {
    const filePath = path.join(ENV_DIR, file);
    if (fs.existsSync(filePath)) {
      log(`✅ ${file} encontrado`, 'green');
    } else {
      missingFiles.push(file);
      log(`⚠️  ${file} no encontrado`, 'yellow');
    }
  });

  if (missingFiles.length > 0) {
    log('\n⚠️  Faltan archivos de environment. Crea los siguientes archivos:', 'yellow');
    missingFiles.forEach(f => log(`   - src/environments/${f}`, 'yellow'));
  }

  // 6. Ejecutar el hook para configurar el environment actual
  log('\n🔄 Configurando environment para la rama actual...', 'cyan');

  const { execSync } = require('child_process');
  try {
    // Obtener rama actual
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: ROOT_DIR,
      encoding: 'utf8'
    }).trim();

    // Determinar qué archivo copiar
    let sourceFile = 'environment.development.ts';
    let envName = 'DESARROLLO';

    if (branch === 'main' || branch === 'master') {
      sourceFile = 'environment.production.ts';
      envName = 'PRODUCCIÓN';
    }

    const sourcePath = path.join(ENV_DIR, sourceFile);
    const targetPath = path.join(ENV_DIR, 'environment.ts');

    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      log(`✅ Environment configurado: ${envName} (rama: ${branch})`, 'green');
    } else {
      log(`⚠️  No se pudo copiar ${sourceFile} - archivo no existe`, 'yellow');
    }
  } catch (err) {
    log('⚠️  No se pudo determinar la rama actual', 'yellow');
  }

  log('\n🎉 Configuración completada!\n', 'green');
  log('El environment se cambiará automáticamente al cambiar de rama.', 'cyan');
  log('  - main/master  → environment.production.ts (PRODUCCIÓN)', 'reset');
  log('  - develop/*    → environment.development.ts (DESARROLLO)\n', 'reset');
}

main();
