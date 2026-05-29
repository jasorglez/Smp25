USE [smp];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'smp')
BEGIN
    EXEC('CREATE SCHEMA [smp]');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[smp].[RiskIdentification]') AND type = 'U')
BEGIN
    CREATE TABLE [smp].[RiskIdentification] (
        [Id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [IdProject]       INT NOT NULL,
        [IdContract]      INT NULL,
        [IdWorkProgram]   INT NULL,
        [Scope]           VARCHAR(20) NOT NULL,
        [Folio]           VARCHAR(30) NOT NULL,
        [Title]           VARCHAR(200) NOT NULL,
        [Description]     VARCHAR(1000) NOT NULL,
        [Cause]           VARCHAR(1000) NULL,
        [Consequence]     VARCHAR(1000) NULL,
        [Category]        VARCHAR(100) NOT NULL,
        [Probability]     INT NOT NULL,
        [ImpactTimeDays]  DECIMAL(10,2) NOT NULL CONSTRAINT [DF_RiskIdentification_ImpactTimeDays] DEFAULT (0),
        [ImpactCost]      DECIMAL(18,2) NOT NULL CONSTRAINT [DF_RiskIdentification_ImpactCost] DEFAULT (0),
        [Criticality]     INT NOT NULL,
        [TrafficLight]    VARCHAR(20) NOT NULL,
        [Responsible]     VARCHAR(150) NOT NULL,
        [ResponsePlan]    VARCHAR(2000) NOT NULL,
        [DueDate]         DATE NOT NULL,
        [Status]          VARCHAR(30) NOT NULL,
        [Notes]           VARCHAR(2000) NULL,
        [Active]          BIT NOT NULL CONSTRAINT [DF_RiskIdentification_Active] DEFAULT (1),
        [CreatedAt]       DATETIME NOT NULL CONSTRAINT [DF_RiskIdentification_CreatedAt] DEFAULT (GETDATE()),
        [CreatedBy]       VARCHAR(100) NULL,
        [UpdatedAt]       DATETIME NULL,
        [UpdatedBy]       VARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_Folio' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE UNIQUE INDEX [IX_RiskIdentification_Folio]
        ON [smp].[RiskIdentification]([Folio]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_Project' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE INDEX [IX_RiskIdentification_Project]
        ON [smp].[RiskIdentification]([IdProject], [Active]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_WorkProgram' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE INDEX [IX_RiskIdentification_WorkProgram]
        ON [smp].[RiskIdentification]([IdWorkProgram]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[smp].[RiskFollowUp]') AND type = 'U')
BEGIN
    CREATE TABLE [smp].[RiskFollowUp] (
        [Id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [IdRisk]          INT NOT NULL,
        [Comment]         VARCHAR(2000) NOT NULL,
        [PreviousStatus]  VARCHAR(30) NULL,
        [NewStatus]       VARCHAR(30) NULL,
        [ProgressPercent] DECIMAL(5,2) NULL,
        [CreatedAt]       DATETIME NOT NULL CONSTRAINT [DF_RiskFollowUp_CreatedAt] DEFAULT (GETDATE()),
        [CreatedBy]       VARCHAR(100) NULL,
        CONSTRAINT [FK_RiskFollowUp_RiskIdentification]
            FOREIGN KEY ([IdRisk]) REFERENCES [smp].[RiskIdentification]([Id])
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskFollowUp_Risk' AND object_id = OBJECT_ID(N'[smp].[RiskFollowUp]'))
BEGIN
    CREATE INDEX [IX_RiskFollowUp_Risk]
        ON [smp].[RiskFollowUp]([IdRisk], [CreatedAt] DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'SeqRiskFolio' AND SCHEMA_NAME(schema_id) = 'smp')
BEGIN
    CREATE SEQUENCE [smp].[SeqRiskFolio]
        AS INT
        START WITH 1
        INCREMENT BY 1;
END
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'microservicio')
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[smp] TO [microservicio];
    GRANT REFERENCES ON SCHEMA::[smp] TO [microservicio];
    GRANT EXECUTE ON SCHEMA::[smp] TO [microservicio];
END
GO

/*
Ejemplo para generar folio:
SELECT CONCAT('RISK-', RIGHT('000' + CAST(NEXT VALUE FOR [smp].[SeqRiskFolio] AS VARCHAR(10)), 3));
*/
