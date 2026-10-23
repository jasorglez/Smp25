USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Plataforma / Deploy Vercel'
      AND title = N'Dependencias compatibles para deploy Vercel'
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
        NULL, NULL, N'5.00.375', N'Plataforma / Deploy Vercel', 'FIX',
        N'Dependencias compatibles para deploy Vercel',
        N'Se alinearon las versiones del framework Angular 21 en package.json y package-lock.json. Se actualizaron AngularFire y ng-apexcharts a versiones compatibles con Angular 21 y se renovaron sus dependencias de Firebase y ApexCharts.',
        N'Permite que Vercel instale las dependencias y compile la aplicación sin el conflicto ERESOLVE.',
        N'Prepara una instalación limpia y un deploy de Vercel sin conflictos de Angular.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Dependencias compatibles para deploy Vercel'
  AND isActive = 1;
GO
