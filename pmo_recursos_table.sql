-- ================================================================
-- PMO_RECURSOS — Tabla de costos reales por recurso y proyecto
-- BD: smp  |  Fecha: 29 Mayo 2026
-- Ejecutar UNA SOLA VEZ en el servidor
-- ================================================================

USE smp;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'pmo_recursos' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.pmo_recursos (
        id            INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_project    INT           NOT NULL,
        id_company    INT           NOT NULL,
        tipo          NVARCHAR(20)  NOT NULL DEFAULT 'Personal',  -- Personal|Material|Equipo|Subcontrato|Indirecto
        descripcion   NVARCHAR(200) NOT NULL DEFAULT '',
        unidad        NVARCHAR(30)  NOT NULL DEFAULT 'día',
        periodo       NVARCHAR(20)  NOT NULL DEFAULT '',          -- semana/quincena/mes ej. '2026-W22'
        cant_plan     DECIMAL(18,4) NOT NULL DEFAULT 0,
        cant_real     DECIMAL(18,4) NOT NULL DEFAULT 0,
        costo_unit_plan DECIMAL(18,4) NOT NULL DEFAULT 0,
        costo_unit_real DECIMAL(18,4) NOT NULL DEFAULT 0,
        active        SMALLINT      NOT NULL DEFAULT 1,
        created_at    DATETIME      NOT NULL DEFAULT GETDATE()
    );

    PRINT 'Tabla pmo_recursos creada correctamente.';
END
ELSE
BEGIN
    PRINT 'Tabla pmo_recursos ya existe — sin cambios.';
END
GO
