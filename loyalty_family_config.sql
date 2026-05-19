-- =====================================================
-- PUNTOS DE FIDELIDAD POR FAMILIA DE PRODUCTO
-- Ejecutar en la BD: administration (66.179.240.10)
-- =====================================================

USE administration;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'loyalty_family_config' AND schema_id = SCHEMA_ID('pv'))
BEGIN
    CREATE TABLE pv.loyalty_family_config (
        id             INT IDENTITY(1,1) PRIMARY KEY,
        id_company     INT NOT NULL,
        id_familia     INT NOT NULL,
        nombre_familia VARCHAR(100) NOT NULL,
        factor_puntos  DECIMAL(5,4) NOT NULL,
        active         BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_loyalty_family UNIQUE (id_company, id_familia)
    );
    PRINT 'Tabla pv.loyalty_family_config creada';
END
ELSE
    PRINT 'pv.loyalty_family_config ya existe';
GO

SELECT COUNT(*) AS registros FROM pv.loyalty_family_config;
GO
