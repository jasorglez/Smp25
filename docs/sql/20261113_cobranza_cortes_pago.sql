USE administration;
GO

/* Medios de pago de Cobranza por empresa. El catálogo admite más opciones. */
INSERT INTO dbo.catalog (id_company, description, valueaddition, valueaddition2, election, type, parent_id, subparent_id, iNivel, active)
SELECT empresas.id_company, medios.description, 'NA', 'NA', 1, 'COBRO_PAGO', NULL, NULL, NULL, 1
FROM (
    SELECT DISTINCT id_company FROM dbo.catalog WHERE id_company IS NOT NULL
    UNION
    SELECT DISTINCT id_root FROM dbo.customers WHERE id_root IS NOT NULL
) empresas
CROSS JOIN (VALUES (N'EFECTIVO'), (N'TRANSFERENCIA'), (N'TARJETA')) medios(description)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.catalog existente
    WHERE existente.id_company = empresas.id_company AND existente.type = 'COBRO_PAGO'
      AND existente.description = medios.description AND existente.active = 1
);
GO

IF COL_LENGTH('dbo.abonos_cobranza', 'id_tipo_pago') IS NULL
    ALTER TABLE dbo.abonos_cobranza ADD id_tipo_pago INT NULL;
IF COL_LENGTH('dbo.abonos_cobranza', 'id_usuario_cobrador') IS NULL
    ALTER TABLE dbo.abonos_cobranza ADD id_usuario_cobrador INT NULL;
GO

IF OBJECT_ID('dbo.cortes_cobranza', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.cortes_cobranza (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_root INT NOT NULL,
        id_usuario_cobrador INT NULL,
        fecha_desde DATE NOT NULL,
        fecha_hasta DATE NOT NULL,
        total DECIMAL(18,2) NOT NULL,
        observaciones NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL DEFAULT 1,
        CONSTRAINT CK_cortes_cobranza_fechas CHECK (fecha_hasta >= fecha_desde)
    );
    CREATE INDEX IX_cortes_cobranza_root_fecha ON dbo.cortes_cobranza(id_root, fecha_desde, fecha_hasta, id_usuario_cobrador);
END;
GO

IF OBJECT_ID('dbo.cortes_cobranza_abonos', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.cortes_cobranza_abonos (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_corte INT NOT NULL,
        id_abono INT NOT NULL,
        id_tipo_pago INT NULL,
        id_usuario_cobrador INT NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_cortes_cobranza_abonos_corte FOREIGN KEY (id_corte) REFERENCES dbo.cortes_cobranza(id),
        CONSTRAINT FK_cortes_cobranza_abonos_abono FOREIGN KEY (id_abono) REFERENCES dbo.abonos_cobranza(id),
        CONSTRAINT UQ_cortes_cobranza_abono UNIQUE (id_corte, id_abono)
    );
END;
GO
