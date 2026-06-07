-- Catálogo peso_volumen + tabla hija empaque_peso_volumen (schema Delison).
-- Correr ANTES de actualizar el backend (v6.17). id_company = 9 (Delison).

----------------------------------------------------------------------
-- 1) Catálogo Peso/Volumen (administrable en Catalogos > Materiales Maestros > Peso / Volumen)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'peso_volumen'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[peso_volumen] (
        [id]           INT          NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_company]   INT          NOT NULL,
        [abreviatura]  VARCHAR(20)  NOT NULL,
        [nombre]       VARCHAR(100) NOT NULL,
        [active]       BIT          NOT NULL DEFAULT 1,
        [datemodified] DATETIME     NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Delison.peso_volumen creada.';

    INSERT INTO [warehouses].[Delison].[peso_volumen] (id_company, abreviatura, nombre, active) VALUES
        (9, 'g',   'Gramo', 1),
        (9, 'kg',  'Kilogramo', 1),
        (9, 'mg',  'Miligramo', 1),
        (9, 'ton', 'Tonelada', 1),
        (9, 'ml',  'Mililitro', 1),
        (9, 'l',   'Litro', 1),
        (9, 'oz',  'Onza', 1),
        (9, 'lb',  'Libra', 1),
        (9, 'gal', 'Galón', 1);
    PRINT 'Peso/Volumen precargado (9).';
END
ELSE
    PRINT 'Delison.peso_volumen ya existe, sin cambios.';

----------------------------------------------------------------------
-- 2) Tabla hija peso/volumen del par material-proveedor (una sola fila por proveedor)
----------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'empaque_peso_volumen'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[empaque_peso_volumen] (
        [id]                 INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_proveedor_tabla] INT            NOT NULL,   -- FK -> warehouses.dbo.proveedorxtablas.Id
        [medida]             DECIMAL(10,2)  NULL,
        [id_unidad]          INT            NULL,        -- FK -> Delison.peso_volumen.id
        [active]             BIT            NOT NULL DEFAULT 1,
        [datemodified]       DATETIME       NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_empaque_peso_volumen_proveedor
        ON [warehouses].[Delison].[empaque_peso_volumen] (id_proveedor_tabla);
    PRINT 'Tabla Delison.empaque_peso_volumen creada.';
END
ELSE
    PRINT 'Delison.empaque_peso_volumen ya existe, sin cambios.';
