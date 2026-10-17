use administration;
/*
  Registro de cambios del producto para alimentar Novedades/Publicidad.
  SQL Server. Las fechas se almacenan en UTC; la zona indica cómo mostrarlas.
*/
IF OBJECT_ID(N'dbo.product_updates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_updates
    (
        id                    BIGINT IDENTITY(1,1) NOT NULL,
        idRoot                INT NULL,
        idCompany             INT NULL,
        version               NVARCHAR(40) NULL,
        module                NVARCHAR(120) NOT NULL,
        changeType            VARCHAR(20) NOT NULL,
        title                 NVARCHAR(180) NOT NULL,
        description           NVARCHAR(MAX) NOT NULL,
        userBenefit           NVARCHAR(600) NULL,
        promoText             NVARCHAR(600) NULL,
        occurredAtUtc         DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_occurredAtUtc DEFAULT SYSUTCDATETIME(),
        displayTimeZone       NVARCHAR(80) NOT NULL
            CONSTRAINT DF_product_updates_displayTimeZone DEFAULT N'America/Indiana/Indianapolis',
        validationStatus      VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_validationStatus DEFAULT 'PENDING',
        releaseStatus         VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_releaseStatus DEFAULT 'LOCAL',
        publicationStatus     VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_publicationStatus DEFAULT 'DRAFT',
        mediaUrl              NVARCHAR(1000) NULL,
        tutorialUrl           NVARCHAR(1000) NULL,
        publishedAtUtc        DATETIME2(0) NULL,
        createdBy              NVARCHAR(160) NULL,
        createdAtUtc           DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_createdAtUtc DEFAULT SYSUTCDATETIME(),
        updatedAtUtc           DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_updatedAtUtc DEFAULT SYSUTCDATETIME(),
        isActive               BIT NOT NULL
            CONSTRAINT DF_product_updates_isActive DEFAULT 1,

        CONSTRAINT PK_product_updates PRIMARY KEY CLUSTERED (id),
        CONSTRAINT CK_product_updates_changeType
            CHECK (changeType IN ('FEATURE', 'IMPROVEMENT', 'FIX', 'TIP', 'SECURITY', 'PERFORMANCE')),
        CONSTRAINT CK_product_updates_validationStatus
            CHECK (validationStatus IN ('PENDING', 'PASSED', 'FAILED')),
        CONSTRAINT CK_product_updates_releaseStatus
            CHECK (releaseStatus IN ('LOCAL', 'TEST', 'PRODUCTION')),
        CONSTRAINT CK_product_updates_publicationStatus
            CHECK (publicationStatus IN ('DRAFT', 'READY', 'PUBLISHED', 'HIDDEN'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.product_updates')
      AND name = N'IX_product_updates_publicity'
)
BEGIN
    CREATE INDEX IX_product_updates_publicity
        ON dbo.product_updates (publicationStatus, isActive, occurredAtUtc DESC)
        INCLUDE (idRoot, idCompany, version, module, changeType, title, userBenefit, promoText, mediaUrl, tutorialUrl);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.product_updates')
      AND name = N'IX_product_updates_tenant_history'
)
BEGIN
    CREATE INDEX IX_product_updates_tenant_history
        ON dbo.product_updates (idRoot, idCompany, occurredAtUtc DESC)
        INCLUDE (version, module, changeType, title, validationStatus, releaseStatus, publicationStatus, isActive);
END;
GO
