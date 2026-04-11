-- =====================================================================
-- SCRIPT SQL: Agregar campo costo y modificar vista
-- Base de datos: warehouses
-- =====================================================================

-- 1. AGREGAR COLUMNA costo A LA TABLA materials (si no existe)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE Object_ID = Object_ID('dbo.materials') AND name = 'costo')
BEGIN
    ALTER TABLE dbo.materials ADD costo DECIMAL(18,2) NULL;
    PRINT 'Columna costo agregada a la tabla materials';
END
ELSE
BEGIN
    PRINT 'La columna costo ya existe en la tabla materials';
END
GO

-- 2. MIGRAR DATOS EXISTENTES: Calcular costo desde MateriaByCatalog
UPDATE m
SET m.costo = ISNULL(sub.costo_total, 0)
FROM dbo.materials m
INNER JOIN (
    SELECT 
        id_concep,
        SUM(CASE WHEN [check] = 1 THEN costo_tot ELSE 0 END) as costo_total
    FROM dbo.materiaByCatalog
    WHERE active = 1
    GROUP BY id_concep
) sub ON m.id = sub.id_concep;
PRINT 'Datos migrados a la columna costo';
GO

-- 3. MOSTRAR RESULTADOS
SELECT TOP 20 id, insumo, costo FROM dbo.materials WHERE costo > 0 ORDER BY id;
GO

-- =====================================================================
-- NOTA IMPORTANTE:
-- =====================================================================
-- El backend (MateriaByCatalogService.cs) ahora actualiza automáticamente
-- el campo costo en la tabla materials cuando se:
-- - Crea un nuevo registro en MateriaByCatalog
-- - Actualiza un registro existente en MateriaByCatalog
-- - Elimina un registro en MateriaByCatalog
--
-- La vista vw_MaterialsWithCounts ya existe y usa costos_count.
-- El campo costos_count de la vista ahora mostrará el valor de m.costo
-- (siempre que la vista se haya creado para leer directamente de la tabla)
--
-- Si la vista tiene un cálculo complejo, puede que necesites recrearla
-- para que lea directamente de la tabla materials.costo
-- =====================================================================
