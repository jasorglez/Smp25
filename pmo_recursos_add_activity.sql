-- ================================================================
-- PMO Recursos — Agregar columna id_activity
-- Ejecutar en BD: smp
-- ================================================================

USE smp;
GO

-- Agregar id_activity si no existe
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'pmo_recursos' AND COLUMN_NAME = 'id_activity'
)
BEGIN
    ALTER TABLE dbo.pmo_recursos
    ADD id_activity INT NULL;
    PRINT 'Columna id_activity agregada a pmo_recursos.';
END
ELSE
    PRINT 'Columna id_activity ya existe.';
GO

-- Verificar
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'pmo_recursos'
ORDER BY ORDINAL_POSITION;
GO
