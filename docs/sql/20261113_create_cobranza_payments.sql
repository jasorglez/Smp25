/* Historial de abonos por cliente del módulo Cobranza (base Administration). */
IF OBJECT_ID(N'dbo.pagos_cobranzas', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.pagos_cobranzas
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pagos_cobranzas PRIMARY KEY,
        id_customer INT NOT NULL,
        fecha_pago DATE NOT NULL,
        comentario NVARCHAR(500) NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_pagos_cobranzas_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_pagos_cobranzas_active DEFAULT (1),
        CONSTRAINT CK_pagos_cobranzas_monto CHECK (monto > 0),
        CONSTRAINT FK_pagos_cobranzas_customers FOREIGN KEY (id_customer) REFERENCES dbo.customers(id)
    );
    CREATE INDEX IX_pagos_cobranzas_customer_fecha
        ON dbo.pagos_cobranzas (id_customer, fecha_pago DESC, id DESC)
        INCLUDE (monto, active);
END;
GO
