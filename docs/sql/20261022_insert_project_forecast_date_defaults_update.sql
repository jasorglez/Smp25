USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / Proyectos'
      AND title = N'Fechas predeterminadas de pronóstico al crear proyectos'
      AND version = N'5.00.367'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.367', N'Proyectos / Proyectos', 'IMPROVEMENT',
        N'Fechas predeterminadas de pronóstico al crear proyectos',
        N'Al crear un proyecto, Pronóstico LPO toma el primer día del mes actual, Pronóstico TTT el 31 de diciembre del año actual y Clasificación inicia en Terrestre. Al editar, las fechas y clasificación guardadas se mantienen.',
        N'Ahorra captura de datos y prepara el periodo del pronóstico desde el alta del proyecto.',
        N'Crea proyectos con sus fechas de pronóstico y clasificación iniciales listas para revisar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Fechas predeterminadas de pronóstico al crear proyectos'
  AND isActive = 1;
GO
