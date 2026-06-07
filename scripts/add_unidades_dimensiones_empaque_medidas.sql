-- Crea 3 tablas en schema Delison y precarga catálogos.
-- Correr ANTES de actualizar el backend (v6.16).
-- id_company = 9 (Delison).

----------------------------------------------------------------------
-- 1) Catálogo de unidades de medida (administrable en Catalogos > Materiales Maestros > Unidades)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'unidad_medida'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[unidad_medida] (
        [id]           INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_company]   INT          NOT NULL,
        [abreviatura]  VARCHAR(20)  NOT NULL,
        [nombre]       VARCHAR(100) NOT NULL,
        [active]       BIT          NOT NULL DEFAULT 1,
        [datemodified] DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Delison.unidad_medida creada.';

    INSERT INTO [warehouses].[Delison].[unidad_medida] (id_company, abreviatura, nombre, active) VALUES
        (9, 'mm', 'Milímetro', 1),
        (9, 'cm', 'Centímetro', 1),
        (9, 'm',  'Metro', 1),
        (9, 'km', 'Kilómetro', 1),
        (9, 'in', 'Pulgada', 1),
        (9, 'ft', 'Pie', 1),
        (9, 'yd', 'Yarda', 1),
        (9, 'mi', 'Milla', 1);
    PRINT 'Unidades precargadas (8).';
END
ELSE
    PRINT 'Delison.unidad_medida ya existe, sin cambios.';

----------------------------------------------------------------------
-- 2) Catálogo de dimensiones (administrable en Catalogos > Materiales Maestros > Dimensiones)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'dimension'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[dimension] (
        [id]           INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_company]   INT          NOT NULL,
        [nombre]       VARCHAR(100) NOT NULL,
        [active]       BIT          NOT NULL DEFAULT 1,
        [datemodified] DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Delison.dimension creada.';

    INSERT INTO [warehouses].[Delison].[dimension] (id_company, nombre, active) VALUES
        (9, 'largo', 1),
        (9, 'alto', 1),
        (9, 'ancho', 1);
    PRINT 'Dimensiones precargadas (3).';
END
ELSE
    PRINT 'Delison.dimension ya existe, sin cambios.';

----------------------------------------------------------------------
-- 3) Medidas de empaque (hija multifila del par material-proveedor en proveedorxtablas)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'empaque_medidas'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[empaque_medidas] (
        [id]                 INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_proveedor_tabla] INT            NOT NULL,   -- FK -> warehouses.dbo.proveedorxtablas.Id
        [medida]             DECIMAL(10,2)  NULL,
        [id_unidad]          INT            NULL,        -- FK -> Delison.unidad_medida.id
        [id_dimension]       INT            NULL,        -- FK -> Delison.dimension.id
        [active]             BIT            NOT NULL DEFAULT 1,
        [datemodified]       DATETIME       NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_empaque_medidas_proveedor
        ON [warehouses].[Delison].[empaque_medidas] (id_proveedor_tabla);
    PRINT 'Tabla Delison.empaque_medidas creada.';
END
ELSE
    PRINT 'Delison.empaque_medidas ya existe, sin cambios.';
