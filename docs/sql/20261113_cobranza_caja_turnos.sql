USE administration;
GO

/* Reutiliza pv.cajero_turnos y las tiendas/cajas existentes para aperturas.
   Los abonos cobrados en el negocio quedan ligados al turno; los de domicilio
   conservan NULL para poder manejar Telegram en una etapa posterior. */
IF COL_LENGTH('dbo.abonos_cobranza', 'origen_cobro') IS NULL
    ALTER TABLE dbo.abonos_cobranza ADD origen_cobro NVARCHAR(20) NOT NULL
        CONSTRAINT DF_abonos_cobranza_origen_cobro DEFAULT N'DOMICILIO';
IF COL_LENGTH('dbo.abonos_cobranza', 'id_cajero_turno') IS NULL
    ALTER TABLE dbo.abonos_cobranza ADD id_cajero_turno INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_abonos_cobranza_cajero_turnos')
    ALTER TABLE dbo.abonos_cobranza ADD CONSTRAINT FK_abonos_cobranza_cajero_turnos
        FOREIGN KEY (id_cajero_turno) REFERENCES pv.cajero_turnos(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_abonos_cobranza_id_cajero_turno' AND object_id = OBJECT_ID('dbo.abonos_cobranza'))
    CREATE INDEX IX_abonos_cobranza_id_cajero_turno ON dbo.abonos_cobranza(id_cajero_turno)
        WHERE id_cajero_turno IS NOT NULL;
GO

/* Agrega el permiso hijo para mostrar la pantalla de apertura de caja. */
USE security;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = (SELECT TOP 1 id FROM dbo.masterpermissions WHERE identifier = 'cobranzas') AND identifier = 'aperturacaja')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active, [order])
    SELECT id, N'Apertura Caja', 'aperturacaja', N'Apertura de turno de caja para Cobranza', 1, 15
    FROM dbo.masterpermissions WHERE identifier = 'cobranzas';
END;
GO

USE administration;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WHERE version = N'5.00.492' AND module = N'Cobranza / Caja y abonos' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
    INSERT INTO dbo.product_updates (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,createdAtUtc,updatedAtUtc,isActive)
    VALUES (NULL,NULL,N'5.00.492',N'Cobranza / Caja y abonos',N'IMPROVEMENT',N'Apertura de caja y ticket de abonos',N'Cobranza permite abrir turno con tienda, caja y fondo inicial; distingue los abonos recibidos en negocio y domicilio y genera un ticket imprimible.',N'Facilita controlar el efectivo por turno y entregar un comprobante de cada pago.',N'Abre tu caja de cobranza y entrega un ticket al registrar cada abono.',SYSUTCDATETIME(),N'America/Indiana/Indianapolis',N'PENDING',N'LOCAL',N'DRAFT',NULL,NULL,SYSUTCDATETIME(),SYSUTCDATETIME(),1);
END;
GO
