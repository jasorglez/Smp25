USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @updates TABLE
(
    version NVARCHAR(40),
    module NVARCHAR(120),
    changeType VARCHAR(20),
    title NVARCHAR(180),
    description NVARCHAR(MAX),
    userBenefit NVARCHAR(600),
    promoText NVARCHAR(600),
    occurredAtUtc DATETIME2(0)
);

INSERT INTO @updates
    (version, module, changeType, title, description, userBenefit, promoText, occurredAtUtc)
VALUES
    (N'5.00.396', N'Seguridad / Usuarios', 'FEATURE', N'Permisos maestros por empresa',
     N'El detalle de empresas de cada usuario permite consultar y editar los permisos maestros habilitados para cada empresa; los permisos CRUD por sucursal continúan disponibles.',
     N'Permite administrar los permisos desde el detalle de empresas del usuario y mantenerlos asociados a cada empresa.',
     N'Administra los permisos maestros de cada empresa desde el detalle de usuarios.', '2026-10-27T14:35:00'),
    (N'5.00.398', N'Seguridad / Usuarios', 'IMPROVEMENT', N'Más espacio para permisos maestros por empresa',
     N'El panel expandido de permisos maestros ahora tiene más altura para consultar y administrar más permisos a la vez.',
     N'Da más espacio vertical al listado de permisos dentro del detalle de empresa.',
     N'Consulta más permisos maestros a la vez desde el detalle de la empresa.', '2026-10-27T14:52:00'),
    (N'5.00.402', N'Seguridad / Usuarios', 'FIX', N'Volver a todos los usuarios desde cualquier detalle',
     N'La X cierra cualquier vista expandida, incluidos Permisos/Sucursales y Empresas, y restaura el listado completo de usuarios.',
     N'Permite regresar al listado completo sin quedarse filtrado en un usuario.',
     N'Cierra cualquier detalle con la X y vuelve a todos los usuarios.', '2026-10-27T16:14:00');

UPDATE target
SET changeType = source.changeType,
    description = source.description,
    userBenefit = source.userBenefit,
    promoText = source.promoText,
    occurredAtUtc = source.occurredAtUtc,
    displayTimeZone = N'America/Indiana/Indianapolis',
    validationStatus = 'PENDING',
    releaseStatus = 'LOCAL',
    publicationStatus = 'PUBLISHED',
    publishedAtUtc = COALESCE(target.publishedAtUtc, @nowUtc),
    updatedAtUtc = @nowUtc
FROM dbo.product_updates AS target
JOIN @updates AS source
  ON target.idRoot IS NULL
 AND target.idCompany IS NULL
 AND target.version = source.version
 AND target.module = source.module
 AND target.title = source.title
 AND target.isActive = 1;

INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
     createdBy, isActive)
SELECT NULL, NULL, source.version, source.module, source.changeType, source.title,
       source.description, source.userBenefit, source.promoText, source.occurredAtUtc,
       N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
       NULL, 1
FROM @updates AS source
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.product_updates AS target
    WHERE target.idRoot IS NULL
      AND target.idCompany IS NULL
      AND target.version = source.version
      AND target.module = source.module
      AND target.title = source.title
      AND target.isActive = 1
);

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version IN (N'5.00.396', N'5.00.398', N'5.00.402')
  AND module = N'Seguridad / Usuarios' AND isActive = 1
ORDER BY version;
GO
