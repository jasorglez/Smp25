/* Plan de préstamos y cobros por cliente en Administration.
   Cada préstamo genera 10 cuotas mensuales; cada cuota puede recibir varios abonos. */
IF OBJECT_ID(N'dbo.prestamos_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.prestamos_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_prestamos_cobranza PRIMARY KEY,
        id_customer INT NOT NULL,
        monto_total DECIMAL(18,2) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_primer_pago DATE NOT NULL,
        numero_cuotas INT NOT NULL CONSTRAINT DF_prestamos_cobranza_numero_cuotas DEFAULT (10),
        comentario NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_prestamos_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_prestamos_cobranza_active DEFAULT (1),
        CONSTRAINT CK_prestamos_cobranza_monto CHECK (monto_total > 0),
        CONSTRAINT CK_prestamos_cobranza_cuotas CHECK (numero_cuotas = 10),
        CONSTRAINT FK_prestamos_cobranza_customers FOREIGN KEY (id_customer) REFERENCES dbo.customers(id)
    );
    CREATE INDEX IX_prestamos_cobranza_customer ON dbo.prestamos_cobranza(id_customer, active, inicio DESC);
END;
GO

IF OBJECT_ID(N'dbo.cuotas_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cuotas_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cuotas_cobranza PRIMARY KEY,
        id_prestamo INT NOT NULL,
        numero_cuota INT NOT NULL,
        fecha_programada DATE NOT NULL,
        monto_programado DECIMAL(18,2) NOT NULL,
        comentario NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_cuotas_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_cuotas_cobranza_active DEFAULT (1),
        CONSTRAINT CK_cuotas_cobranza_numero CHECK (numero_cuota BETWEEN 1 AND 10),
        CONSTRAINT CK_cuotas_cobranza_monto CHECK (monto_programado > 0),
        CONSTRAINT UQ_cuotas_cobranza_numero UNIQUE (id_prestamo, numero_cuota),
        CONSTRAINT FK_cuotas_cobranza_prestamos FOREIGN KEY (id_prestamo) REFERENCES dbo.prestamos_cobranza(id)
    );
    CREATE INDEX IX_cuotas_cobranza_prestamo_fecha ON dbo.cuotas_cobranza(id_prestamo, fecha_programada, numero_cuota);
END;
GO

IF OBJECT_ID(N'dbo.abonos_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.abonos_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_abonos_cobranza PRIMARY KEY,
        id_cuota INT NOT NULL,
        fecha_pago DATE NOT NULL,
        comentario NVARCHAR(500) NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_abonos_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_abonos_cobranza_active DEFAULT (1),
        CONSTRAINT CK_abonos_cobranza_monto CHECK (monto > 0),
        CONSTRAINT FK_abonos_cobranza_cuotas FOREIGN KEY (id_cuota) REFERENCES dbo.cuotas_cobranza(id)
    );
    CREATE INDEX IX_abonos_cobranza_cuota_fecha ON dbo.abonos_cobranza(id_cuota, fecha_pago, id);
END;
GO
