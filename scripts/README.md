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

#### Flujo recomendado para deploy

**Servidor de Producción (rama main):**
```bash
git pull origin main
docker-compose up --build -d
```
El hook `post-merge` actualizará el environment automáticamente antes del build.

**Servidor de Staging (rama develop):**
```bash
git pull origin develop
docker-compose up --build -d
```

#### Respaldo: Build Arg (si no hay Git)

Si haces build sin repositorio Git, usa el ARG:
```bash
# Producción
docker build --build-arg ENVIRONMENT=production -t app:prod .

# Desarrollo
docker build --build-arg ENVIRONMENT=development -t app:dev .
```

O con docker-compose:
```bash
ENVIRONMENT=development docker-compose up --build
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
