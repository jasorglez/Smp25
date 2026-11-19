USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.prestamos_cobranza')
      AND name = N'CK_prestamos_cobranza_cuotas'
)
    ALTER TABLE dbo.prestamos_cobranza
        DROP CONSTRAINT CK_prestamos_cobranza_cuotas;

ALTER TABLE dbo.prestamos_cobranza
    ADD CONSTRAINT CK_prestamos_cobranza_cuotas
    CHECK (numero_cuotas >= 1);

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.cuotas_cobranza')
      AND name = N'CK_cuotas_cobranza_numero'
)
    ALTER TABLE dbo.cuotas_cobranza
        DROP CONSTRAINT CK_cuotas_cobranza_numero;

ALTER TABLE dbo.cuotas_cobranza
    ADD CONSTRAINT CK_cuotas_cobranza_numero
    CHECK (numero_cuota >= 1);

COMMIT TRANSACTION;
GO

SELECT name, is_disabled, is_not_trusted
FROM sys.check_constraints
WHERE name IN (N'CK_prestamos_cobranza_cuotas', N'CK_cuotas_cobranza_numero');
GO
