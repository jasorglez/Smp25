USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @module NVARCHAR(120) = N'Seguridad / Usuarios / Proyectos y órdenes';
DECLARE @title NVARCHAR(180) = N'Permisos de órdenes anidados bajo cada proyecto';
DECLARE @version NVARCHAR(40) = N'5.00.445';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'FIX',
        description = N'La columna Proyecto se reduce y Órdenes conserva el botón con icono y contador del resto de permisos. Permite desplegar las órdenes de cada proyecto para asignar o quitar permisos al usuario.',
        userBenefit = N'Administra las asignaciones de órdenes desde el proyecto del usuario, manteniendo la navegación habitual de permisos.',
        promoText = N'Asigna órdenes al usuario desde cada proyecto con el mismo esquema de iconos y contadores.',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1;
END
ELSE
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
        NULL, NULL, @version, @module, 'FIX', @title,
        N'La columna Proyecto se reduce y Órdenes conserva el botón con icono y contador del resto de permisos. Permite desplegar las órdenes de cada proyecto para asignar o quitar permisos al usuario.',
        N'Administra las asignaciones de órdenes desde el proyecto del usuario, manteniendo la navegación habitual de permisos.',
        N'Asigna órdenes al usuario desde cada proyecto con el mismo esquema de iconos y contadores.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = @module AND title = @title AND version = @version
  AND isActive = 1;
GO
