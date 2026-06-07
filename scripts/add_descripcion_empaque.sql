-- Crea tabla Delison.descripcion_empaque en warehouses
-- Correr ANTES de actualizar el backend (v6.15)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison'
      AND TABLE_NAME   = 'descripcion_empaque'
)
BEGIN
    CREATE TABLE [warehouses].[Delison].[descripcion_empaque] (
        [id]           INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
        [id_company]   INT           NOT NULL,
        [descripcion]  VARCHAR(200)  NOT NULL,
        [active]       BIT           NOT NULL DEFAULT 1,
        [datemodified] DATETIME      NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla Delison.descripcion_empaque creada correctamente.';
END
ELSE
BEGIN
    PRINT 'La tabla Delison.descripcion_empaque ya existe, no se realizo ningun cambio.';
END
