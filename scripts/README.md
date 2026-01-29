# Scripts de Configuración

## Sistema de Environments por Rama

Este proyecto utiliza un sistema automático de cambio de environment según la rama de Git.

### Archivos de Environment

| Archivo | Rama | Ambiente | Endpoints |
|---------|------|----------|-----------|
| `environment.production.ts` | `main` / `master` | Producción | bi2.com.mx |
| `environment.development.ts` | `develop` / otras | Desarrollo | ms-pruebas-api.bi2.mx |
| `environment.ts` | - | **Generado automáticamente** | Según rama actual |

> **Importante:** Nunca edites `environment.ts` directamente. Edita los archivos `.production.ts` o `.development.ts` según corresponda.

### Cómo Funciona

Dos **Git Hooks** detectan cambios de rama:
- `post-checkout` → Se ejecuta con `git checkout` / `git switch`
- `post-merge` → Se ejecuta con `git pull`

Automáticamente copian el environment correcto a `environment.ts`.

```
git checkout main     →  Copia environment.production.ts
git checkout develop  →  Copia environment.development.ts
git pull              →  Actualiza environment.ts según rama actual
```

### Instalación

#### Opción 1: Automática (recomendada)
```bash
npm install
```
El hook se instala automáticamente via `postinstall`.

#### Opción 2: Manual
```bash
npm run setup-hooks
```

### Desarrollo Local

#### Primera vez (nuevo desarrollador)

```bash
# 1. Clonar el repositorio
git clone https://github.com/jasorglez/Smp25.git
cd Smp25

# 2. Cambiar a la rama de desarrollo
git checkout develop

# 3. Instalar dependencias (esto también instala los hooks automáticamente)
npm install

# 4. Verificar que el environment está configurado
cat src/environments/environment.ts | head -3
# Debería mostrar: "// Environment de DESARROLLO"

# 5. Iniciar el servidor de desarrollo
npm start
```

#### Desarrollador existente (actualizar hooks)

Si ya tienes el proyecto y necesitas instalar/actualizar los hooks:

```bash
npm run setup-hooks
```

Esto hará:
- Instalar hooks `post-checkout` y `post-merge`
- Configurar `environment.ts` según tu rama actual
- Crear archivo `.env` para docker-compose

#### Cambiar entre ambientes manualmente

Si necesitas probar con un ambiente diferente sin cambiar de rama:

```bash
# Usar ambiente de producción temporalmente
cp src/environments/environment.production.ts src/environments/environment.ts

# Volver al ambiente de desarrollo
cp src/environments/environment.development.ts src/environments/environment.ts

# O simplemente cambiar de rama (el hook lo hace automático)
git checkout main      # → producción
git checkout develop   # → desarrollo
```

### Verificación

Después de instalar, verifica que el hook funcione:
```bash
# Debería mostrar el environment actual
cat src/environments/environment.ts | head -5
```

### Troubleshooting

#### El environment no cambia al cambiar de rama

1. Verifica que los hooks existen:
   ```bash
   ls -la .git/hooks/post-checkout .git/hooks/post-merge
   ```

2. Reinstala los hooks:
   ```bash
   npm run setup-hooks
   ```

3. En Windows, asegúrate de tener Git Bash instalado.

#### Error: "No se encontró el directorio .git"

El script requiere estar en un repositorio Git. En Docker o CI/CD, el environment se configura de forma diferente (ver sección Docker).

### Docker / Docker Compose

#### Funcionamiento Automático

Los hooks de Git generan automáticamente un archivo `.env` con el ENVIRONMENT correcto:

| Rama | Archivo .env generado |
|------|----------------------|
| `main` / `master` | `ENVIRONMENT=production` |
| `develop` / otras | `ENVIRONMENT=development` |

Docker-compose lee este `.env` automáticamente.

#### Flujo de deploy (100% automático)

**Servidor de Producción (rama main):**
```bash
git pull origin main           # Hook actualiza .env → ENVIRONMENT=production
docker-compose up --build -d   # Usa production automáticamente
```

**Servidor de Staging (rama develop):**
```bash
git pull origin develop        # Hook actualiza .env → ENVIRONMENT=development
docker-compose up --build -d   # Usa development automáticamente
```

#### Respaldo: Build manual (si no hay Git)

Si haces build sin repositorio Git:
```bash
# Producción
docker build --build-arg ENVIRONMENT=production -t app:prod .

# Desarrollo
docker build --build-arg ENVIRONMENT=development -t app:dev .
```

### CI/CD

En pipelines de CI/CD, configura el environment según el branch:

```yaml
# Ejemplo GitHub Actions
- name: Set environment
  run: |
    if [ "${{ github.ref }}" == "refs/heads/main" ]; then
      cp src/environments/environment.production.ts src/environments/environment.ts
    else
      cp src/environments/environment.development.ts src/environments/environment.ts
    fi
```

### Agregar Nuevo Environment

1. Crea el archivo `src/environments/environment.{nombre}.ts`
2. Edita `scripts/setup-hooks.js` y agrega el case en la sección de branches
3. Ejecuta `npm run setup-hooks` para actualizar el hook

### Estructura de Archivos

```
src/environments/
├── environment.ts              # ⚠️ GENERADO - No editar
├── environment.production.ts   # ✅ Producción (main/master)
└── environment.development.ts  # ✅ Desarrollo (develop/*)

scripts/
├── setup-hooks.js              # Script de instalación
└── README.md                   # Esta documentación
```
