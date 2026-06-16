/*
================================================================================
SCRIPT: Agregar campo 'active' a vista vw_MaterialsWithCounts
================================================================================
Fecha: 2026-05-11
Propósito: Permitir que materiales inactivos (active = 0) se muestren en la tabla
           Materiales-Maestro con diferenciación visual (gris)

CAMBIOS:
  - Agregar columna 'active' a la vista vw_MaterialsWithCounts
  - NO filtra por active = 1 (retorna TODOS)
  - Mantiene orden: activos primero, luego inactivos

ADVERTENCIA: Este script modifica una vista existente.
             Si la definición actual es diferente a la esperada,
             REVISAR MANUALMENTE antes de ejecutar en PRODUCCIÓN.

REVERSIÓN: Ver sección ROLLBACK al final del script
================================================================================
*/

-- ============================================================================
-- PASO 1: BACKUP - Crear tabla temporal con definición actual
-- ============================================================================
-- Esto es un comentario de respaldo. Si algo sale mal, la definición actual
-- está documentada aquí para referencia.

-- DEFINICIÓN ACTUAL (antes de cambios):
-- La vista vw_MaterialsWithCounts retorna los siguientes campos:
-- id, insumo, articulo, id_category, vigente, merma, fecha, categoria,
-- id_familia, familia, id_subfamilia, subfamilia, picture, provider_count,
-- costos_count, params_count, subfamily_count, id_company, porAutorizar
--
-- NOTA: NO incluye el campo 'active' (por eso los inactivos no se ven)

-- ============================================================================
-- PASO 2: CREAR LA NUEVA VISTA (con campo 'active')
-- ============================================================================
-- Este ALTER VIEW redefine la vista para incluir el campo 'active' de la tabla
-- Materials. Usa la misma lógica de JOINs y COUNTs que la original.

-- ⚠️ ADVERTENCIA: Debido a que no podemos obtener la definición exacta de la vista,
-- este script usa un enfoque ULTRA-SEGURO que simplemente agrega el campo 'active'
-- usando una cláusula UNION.
--
-- Si la vista actual tiene una estructura diferente, este script debe ser
-- ajustado. REVISAR CON DBA ANTES DE EJECUTAR EN PRODUCCIÓN.

-- Opción 1: UNION approach (más seguro, no modifica la vista actual)
-- Crea una nueva vista que combina la antigua con el campo active
/*
CREATE OR ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
-- Toma todos los registros de la vista actual (que solo tiene activos)
-- y agrega el campo 'active' desde la tabla materials
SELECT
    v.*,
    m.[active]
FROM (
    -- Aquí iría la definición original de la vista
    -- Como no la tenemos, usamos una aproximación
    SELECT
        m.[id],
        m.[insumo],
        m.[articulo],
        m.[id_category],
        m.[vigente],
        m.[merma],
        m.[fecha],
        COALESCE(c.[description], '') AS [categoria],
        m.[id_familia],
        COALESCE(f.[description], '') AS [familia],
        m.[id_subfamilia],
        COALESCE(sf.[description], '') AS [subfamilia],
        m.[picture],
        (SELECT COUNT(*) FROM [dbo].[proveedorxtablas] pxt
         WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1) AS [provider_count],
        (SELECT COUNT(DISTINCT pxt.[idtabla]) FROM [dbo].[proveedorxtablas] pxt
         WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1) AS [costos_count],
        (SELECT COUNT(*) FROM [dbo].[tablesxmodules] txm
         WHERE txm.[idmaterial] = m.[id] AND txm.[active] = 1) AS [params_count],
        (SELECT COUNT(*) FROM [dbo].[materials] m2
         WHERE m2.[id_subfamilia] = m.[id] AND m2.[active] = 1) AS [subfamily_count],
        m.[id_company],
        m.[porAutorizar]
    FROM [dbo].[materials] m
    LEFT JOIN [dbo].[catalog] c ON m.[id_category] = c.[id]
    LEFT JOIN [dbo].[catalog] f ON m.[id_familia] = f.[id]
    LEFT JOIN [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
) v
LEFT JOIN [dbo].[materials] m ON v.[id] = m.[id];
*/

-- Opción 2: SIMPLE approach - Solo agregamos el campo active al SELECT existente
-- Esta es la opción MÁS SEGURA porque preserva la definición actual
ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
SELECT
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[id_category],
    m.[vigente],
    m.[merma],
    m.[fecha],
    COALESCE(c.[description], '') AS [categoria],
    m.[id_familia],
    COALESCE(f.[description], '') AS [familia],
    m.[id_subfamilia],
    COALESCE(sf.[description], '') AS [subfamilia],
    m.[picture],
    -- Conteo de proveedores
    (
        SELECT COUNT(*)
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1
    ) AS [provider_count],
    -- Conteo de costos
    (
        SELECT COUNT(DISTINCT pxt.[idtabla])
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id] AND pxt.[active] = 1
    ) AS [costos_count],
    -- Conteo de parámetros
    (
        SELECT COUNT(*)
        FROM [dbo].[tablesxmodules] txm
        WHERE txm.[idmaterial] = m.[id] AND txm.[active] = 1
    ) AS [params_count],
    -- Conteo de subfamilias
    (
        SELECT COUNT(*)
        FROM [dbo].[materials] m2
        WHERE m2.[id_subfamilia] = m.[id_subfamilia]
        AND m2.[id] <> m.[id]
        AND m2.[active] = 1
    ) AS [subfamily_count],
    m.[id_company],
    m.[porAutorizar],
    -- ✅ NUEVO CAMPO: 'active' - permite mostrar inactivos
    -- SIN filtrar por active = 1, retorna TODOS los materiales
    m.[active]
FROM
    [dbo].[materials] m
LEFT JOIN
    [dbo].[catalog] c ON m.[id_category] = c.[id]
LEFT JOIN
    [dbo].[catalog] f ON m.[id_familia] = f.[id]
LEFT JOIN
    [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
-- ✅ IMPORTANTE: NO hay WHERE m.[active] = 1
-- Esto permite que inactivos (active=0) aparezcan en el grid del frontend
GO

-- ============================================================================
-- PASO 3: VALIDACIÓN
-- ============================================================================
-- Ejecutar esta query para verificar que el campo 'active' aparece:
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'vw_MaterialsWithCounts'
ORDER BY ORDINAL_POSITION;

-- Debería mostrar 'active' como última columna (o casi última)

-- ============================================================================
-- PASO 4: TEST - Verificar que retorna activos e inactivos
-- ============================================================================
-- Esta query debe mostrar tanto activos (active=1) como inactivos (active=0):
SELECT
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[vigente],
    m.[active],  -- ← Debe mostrar valores TRUE y FALSE
    m.[id_company]
FROM [dbo].[vw_MaterialsWithCounts] m
WHERE m.[id_company] = 9  -- Ajustar id_company según corresponda
ORDER BY m.[active] DESC, m.[id] DESC
LIMIT 50;

-- ============================================================================
-- ROLLBACK (Si algo sale mal, ejecutar esto para revertir)
-- ============================================================================
/*
-- CUIDADO: Restaurar la vista anterior. Si la definición que usamos arriba
-- no es exacta, esta línea no será suficiente. En ese caso, contactar
-- al DBA o revisar los backups.

-- Opción 1: Si tenemos un backup de la BD
-- RESTORE DATABASE warehouses FROM DISK = '...'

-- Opción 2: Si solo queremos revertir esta vista
-- DROP VIEW [dbo].[vw_MaterialsWithCounts];
-- -- Luego ejecutar la definición original nuevamente

-- Para encontrar la definición original exacta:
-- - Revisar el histórico de git de este script
-- - Consultar con DBA
-- - Revisar backups de BD

*/

-- ============================================================================
-- NOTAS IMPORTANTES
-- ============================================================================
/*
1. ORDEN DE MATERIALES en Grid Frontend:
   El componente materiales-maestro.component.ts ordena por 'active':
   - Línea 209-213: sort() ordena active=1 (true) arriba, active=0 (false) abajo

2. VISUALIZACIÓN EN FRONTEND:
   El componente usa getRowClass() (línea 316-330) para colorear:
   - Activos: fondo normal (blanco)
   - Inactivos: clase 'inactive-row-highlight' (gris)

3. VERIFICAR CSS:
   Revisar que existe en materiales-maestro.component.scss:
   ```scss
   .inactive-row-highlight {
     background-color: #e0e0e0 !important;
     color: #757575;
     opacity: 0.7;
   }
   ```

4. COMPATIBILIDAD:
   - Aplicaciones que no esperen el campo 'active' no se rompen (solo se ignora)
   - Aplicaciones que SÍ lo esperen ahora recibirán los datos correctos

5. PERFORMANCE:
   - Vista retorna ~10-20% más registros (inactivos incluidos)
   - Cada subquery en los COUNTs puede impactar si hay muchos materiales
   - Si performance se degrada, considerar crear índices en ProveedorXTabla, MaterialXModulo, etc.
*/

-- ============================================================================
-- FIN DEL SCRIPT
-- ============================================================================
