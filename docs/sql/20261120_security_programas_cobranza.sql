USE security;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Programas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Programas
    (
        id INT IDENTITY(1,1) NOT NULL,
        name NVARCHAR(150) NOT NULL,
        description NVARCHAR(1000) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_Programas_active DEFAULT (1),
        CONSTRAINT PK_Programas PRIMARY KEY CLUSTERED (id)
    );
END;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Programas')
      AND name = N'UX_Programas_name'
)
BEGIN
    CREATE UNIQUE INDEX UX_Programas_name ON dbo.Programas(name);
END;

UPDATE dbo.Programas SET description = N'Clientes y saldos de cobranza. API Administration: Customer y PrestamosCobranza.', active = 1 WHERE name = N'ClientesCobranzasComponent';
IF @@ROWCOUNT = 0 INSERT INTO dbo.Programas (name, description, active) VALUES (N'ClientesCobranzasComponent', N'Clientes y saldos de cobranza. API Administration: Customer y PrestamosCobranza.', 1);

UPDATE dbo.Programas SET description = N'Préstamos, cuotas y registro de abonos. APIs Administration: PrestamosCobranza, CajeroTurno y Catalog; Security: User.', active = 1 WHERE name = N'ClientesCobranzasPagosComponent';
IF @@ROWCOUNT = 0 INSERT INTO dbo.Programas (name, description, active) VALUES (N'ClientesCobranzasPagosComponent', N'Préstamos, cuotas y registro de abonos. APIs Administration: PrestamosCobranza, CajeroTurno y Catalog; Security: User.', 1);

UPDATE dbo.Programas SET description = N'Resumen de cartera y vencimientos. API Administration: PrestamosCobranza/dashboard.', active = 1 WHERE name = N'CobranzaDashboardComponent';
IF @@ROWCOUNT = 0 INSERT INTO dbo.Programas (name, description, active) VALUES (N'CobranzaDashboardComponent', N'Resumen de cartera y vencimientos. API Administration: PrestamosCobranza/dashboard.', 1);

UPDATE dbo.Programas SET description = N'Cobradores y reporte de sus cobros. APIs Security: User; Administration: PrestamosCobranza y Catalog.', active = 1 WHERE name = N'CobradoresCobranzaComponent';
IF @@ROWCOUNT = 0 INSERT INTO dbo.Programas (name, description, active) VALUES (N'CobradoresCobranzaComponent', N'Cobradores y reporte de sus cobros. APIs Security: User; Administration: PrestamosCobranza y Catalog.', 1);

UPDATE dbo.Programas SET description = N'Apertura de turno, movimientos y corte de caja. APIs Administration: CortesCobranza, CajeroTurno, Stores y CashRegisters; Security: User.', active = 1 WHERE name = N'CorteCajaCobranzaComponent';
IF @@ROWCOUNT = 0 INSERT INTO dbo.Programas (name, description, active) VALUES (N'CorteCajaCobranzaComponent', N'Apertura de turno, movimientos y corte de caja. APIs Administration: CortesCobranza, CajeroTurno, Stores y CashRegisters; Security: User.', 1);

COMMIT TRANSACTION;

SELECT id, name, description, active
FROM dbo.Programas
WHERE name IN
(
    N'ClientesCobranzasComponent',
    N'ClientesCobranzasPagosComponent',
    N'CobranzaDashboardComponent',
    N'CobradoresCobranzaComponent',
    N'CorteCajaCobranzaComponent'
)
ORDER BY name;
GO
