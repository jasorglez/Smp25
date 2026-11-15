USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.544',
    module = N'Ventas / Cotizaciones',
    changeType = N'FIX',
    title = N'Editor accesible para el encabezado de cotizaciones',
    description = N'El formulario para editar destinatario y encabezado aparece dentro del detalle, encima de las partidas o del PDF, sin una ventana flotante que pueda quedar bloqueada por la cuadrícula.',
    userBenefit = N'Mantiene visibles los campos de edición y evita que los clics activen acciones de la cotización de fondo.',
    promoText = N'Edita el encabezado desde el mismo detalle de la cotización, sin ventanas que se queden bloqueadas.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
