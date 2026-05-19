-- =====================================================
-- SISTEMA DE FIDELIDAD (LOYALTY) - VENTAS AL PÚBLICO
-- Opción B: puntos = total_venta × factor_puntos
-- Ejecutar en la BD: administration (66.179.240.10)
-- =====================================================

USE administration;
GO

-- 1. Configuración del factor de puntos por empresa
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'loyalty_config' AND schema_id = SCHEMA_ID('pv'))
BEGIN
    CREATE TABLE pv.loyalty_config (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        id_company    INT NOT NULL,
        factor_puntos DECIMAL(5,4) NOT NULL DEFAULT 0.1000,  -- 10% por defecto
        active        BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_loyalty_config_company UNIQUE (id_company)
    );
    PRINT 'Tabla pv.loyalty_config creada';
END
ELSE
    PRINT 'pv.loyalty_config ya existe';
GO

-- 2. Saldo de puntos acumulados por teléfono + empresa
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'loyalty_accounts' AND schema_id = SCHEMA_ID('pv'))
BEGIN
    CREATE TABLE pv.loyalty_accounts (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        phone_number  VARCHAR(20) NOT NULL,
        id_company    INT NOT NULL,
        total_points  DECIMAL(18,2) NOT NULL DEFAULT 0,
        updated_at    DATETIME NOT NULL DEFAULT GETDATE(),
        active        BIT NOT NULL DEFAULT 1,
        CONSTRAINT UQ_loyalty_accounts_phone_company UNIQUE (phone_number, id_company)
    );
    PRINT 'Tabla pv.loyalty_accounts creada';
END
ELSE
    PRINT 'pv.loyalty_accounts ya existe';
GO

-- 3. Historial de puntos ganados por venta
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'loyalty_transactions' AND schema_id = SCHEMA_ID('pv'))
BEGIN
    CREATE TABLE pv.loyalty_transactions (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        phone_number  VARCHAR(20) NOT NULL,
        id_company    INT NOT NULL,
        id_sale       INT NOT NULL,
        amount        DECIMAL(18,2) NOT NULL,
        factor_used   DECIMAL(5,4) NOT NULL,
        points_earned DECIMAL(18,2) NOT NULL,
        date          DATETIME NOT NULL DEFAULT GETDATE(),
        active        BIT NOT NULL DEFAULT 1
    );
    PRINT 'Tabla pv.loyalty_transactions creada';
END
ELSE
    PRINT 'pv.loyalty_transactions ya existe';
GO

-- 4. Insertar configuración inicial para empresa 10 (factor 10%)
IF NOT EXISTS (SELECT 1 FROM pv.loyalty_config WHERE id_company = 10)
BEGIN
    INSERT INTO pv.loyalty_config (id_company, factor_puntos) VALUES (10, 0.1000);
    PRINT 'Config empresa 10 insertada (factor 10%)';
END
GO

-- Verificar
SELECT 'loyalty_config' AS tabla, COUNT(*) AS registros FROM pv.loyalty_config
UNION ALL
SELECT 'loyalty_accounts', COUNT(*) FROM pv.loyalty_accounts
UNION ALL
SELECT 'loyalty_transactions', COUNT(*) FROM pv.loyalty_transactions;
GO
