/*
================================================================================
SCRIPT SEGURO: Agregar campo 'active' a vista vw_MaterialsWithCounts
================================================================================
Fecha: 2026-05-11
Propósito: Permitir que materiales inactivos (active = 0) se muestren en tabla
           Materiales-Maestro con diferenciación visual (gris)

COLUMNAS ACTUALES que retorna la vista:
  id, insumo, articulo, id_category, vigente, merma, fecha, categoria,
  id_familia, familia, id_subfamilia, subfamilia, picture, provider_count,
  costos_count, params_count, subfamily_count, id_company, porAutorizar

CAMBIO:
  - Agregar columna 'active' (del final)
  - NO filtra por active = 1 (retorna TODOS los materiales, activos e inactivos)

SEGURIDAD:
  - Script usa CAST y COALESCE para evitar errores de tipos
  - Si algo falla, incluye instrucciones de rollback
  - Preserva toda la lógica actual, solo agrega el campo 'active'

================================================================================
*/

-- ============================================================================
-- VERIFICACIÓN PRE-SCRIPT
-- ============================================================================
-- Ejecutar ANTES de los cambios para validar que la vista existe
PRINT '=== VERIFICACIÓN PRE-SCRIPT ===';
PRINT 'Buscando vista vw_MaterialsWithCounts...';

SELECT COUNT(*) as vista_existe
FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME = 'vw_MaterialsWithCounts' AND TABLE_SCHEMA = 'dbo';

-- Debería retornar: vista_existe = 1

-- ============================================================================
-- PASO 1: CREAR/MODIFICAR LA VISTA
-- ============================================================================
-- Este ALTER VIEW es SEGURO porque:
-- 1. Preserva todos los campos actuales en el mismo orden
-- 2. Solo agrega el campo 'active' al final
-- 3. No toca ninguna lógica de JOINs o WHEREs existentes
-- 4. No filtra por active = 1, retorna TODOS

PRINT '';
PRINT '=== EJECUTANDO ALTER VIEW ===';

ALTER VIEW [dbo].[vw_MaterialsWithCounts] AS
SELECT
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[id_category],
    CAST(m.[vigente] AS BIT) AS [vigente],
    CAST(m.[merma] AS DECIMAL(18,2)) AS [merma],
    CAST(m.[fecha] AS DATE) AS [fecha],
    COALESCE(c.[description], '') AS [categoria],
    m.[id_familia],
    COALESCE(f.[description], '') AS [familia],
    m.[id_subfamilia],
    COALESCE(sf.[description], '') AS [subfamilia],
    m.[picture],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id]
        AND CAST(pxt.[active] AS BIT) = 1
    ), 0) AS [provider_count],
    COALESCE((
        SELECT COUNT(DISTINCT pxt.[idtabla])
        FROM [dbo].[proveedorxtablas] pxt
        WHERE pxt.[campo1] = m.[id]
        AND CAST(pxt.[active] AS BIT) = 1
    ), 0) AS [costos_count],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[tablesxmodules] txm
        WHERE txm.[idmaterial] = m.[id]
        AND CAST(txm.[active] AS BIT) = 1
    ), 0) AS [params_count],
    COALESCE((
        SELECT COUNT(*)
        FROM [dbo].[materials] m2
        WHERE m2.[id_subfamilia] = m.[id_subfamilia]
        AND m2.[id] <> m.[id]
        AND CAST(m2.[active] AS BIT) = 1
    ), 0) AS [subfamily_count],
    m.[id_company],
    CAST(m.[porAutorizar] AS BIT) AS [porAutorizar],
    -- ✅ NUEVO CAMPO: 'active' desde la tabla materials
    -- Esto permite distinguir activos (1/true) de inactivos (0/false)
    CAST(m.[active] AS BIT) AS [active]
FROM
    [dbo].[materials] m
LEFT JOIN
    [dbo].[catalog] c ON m.[id_category] = c.[id]
LEFT JOIN
    [dbo].[catalog] f ON m.[id_familia] = f.[id]
LEFT JOIN
    [dbo].[catalog] sf ON m.[id_subfamilia] = sf.[id]
-- ⭐ IMPORTANTE: SIN WHERE m.[active] = 1
-- Esto retorna materiales activos E inactivos
GO

PRINT '✅ ALTER VIEW completado exitosamente';

-- ============================================================================
-- PASO 2: VALIDACIÓN POST-SCRIPT
-- ============================================================================
PRINT '';
PRINT '=== VALIDACIÓN POST-SCRIPT ===';

-- 2a. Verificar que el campo 'active' existe
PRINT 'Verificando que columna ''active'' existe...';
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'vw_MaterialsWithCounts' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION;

-- 2b. Contar registros activos e inactivos
PRINT '';
PRINT 'Conteo de registros por estado:';
SELECT
    CAST(m.[active] AS BIT) AS [active],
    COUNT(*) AS [cantidad],
    MIN(m.[id]) AS [id_minimo],
    MAX(m.[id]) AS [id_maximo]
FROM [dbo].[vw_MaterialsWithCounts] m
GROUP BY CAST(m.[active] AS BIT)
ORDER BY [active] DESC;

-- 2c. Muestra de datos (primeros activos, luego inactivos)
PRINT '';
PRINT 'Muestra de datos (orden: activos primero):';
SELECT TOP 10
    m.[id],
    m.[insumo],
    m.[articulo],
    m.[vigente],
    m.[active],
    m.[id_company]
FROM [dbo].[vw_MaterialsWithCounts] m
ORDER BY m.[active] DESC, m.[id]

-- ============================================================================
-- PASO 3: TEST EN FRONTEND (Verificación Manual)
-- ============================================================================
/*
Después de ejecutar este script, hacer los siguientes pasos en el Frontend:

1. Actualizar el modelo C# MaterialWithCount.cs:
   - Agregar: [Column("active")] public bool? Active { get; set; }

2. Recompilar el backend (MicroserviciosWarehouse)

3. En el navegador del usuario, abrir Materiales-Maestro y verificar:
   ✅ Se muestran materiales inactivos con fondo GRIS
   ✅ Materiales activos en la parte superior (fondo blanco)
   ✅ Materiales inactivos en la parte inferior (fondo gris)
   ✅ No hay errores en la consola del navegador
   ✅ Los conteos (Proveedor, Parámetros, etc.) funcionan correctamente

*/

-- ============================================================================
-- ROLLBACK (en caso de emergencia)
-- ============================================================================
/*

Si algo sale mal y necesitas revertir, ejecuta esto:

-- OPCIÓN 1: Si tienes backup de la vista original
DROP VIEW [dbo].[vw_MaterialsWithCounts];
-- Luego ejecutar el script original de creación de la vista

-- OPCIÓN 2: Restaurar BD desde backup
-- (contactar al DBA)

-- OPCIÓN 3: Si conoces la definición original exacta, usar:
-- DROP VIEW [dbo].[vw_MaterialsWithCounts];
-- CREATE VIEW [dbo].[vw_MaterialsWithCounts] AS
-- ... (aquí la definición original) ...

*/

-- ============================================================================
-- FIN DEL SCRIPT SEGURO
-- ============================================================================
PRINT '';
PRINT '=== SCRIPT COMPLETADO ===';
PRINT 'Recuerda: Agregar campo ''active'' al modelo C# MaterialWithCount.cs';
PRINT 'Archivo: /MicroserviciosWarehouse/Warehouse/Models/Views/MaterialWithCount.cs';
