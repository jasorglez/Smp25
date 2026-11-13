USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @now DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
 WHERE version = N'5.00.465' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,
 occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.465',N'Administración / Clientes y proveedores','FIX',N'Protección al eliminar clientes y proveedores',N'Solicita confirmación antes de eliminar. Bloquea proveedores con movimientos administrativos o entradas vinculadas a sus OC y clientes con ingresos, egresos, ventas o créditos, incluyendo historial. Si falla la validación, conserva el registro. Requiere publicar el backend de Administración.',N'Evita eliminar clientes y proveedores con datos relacionados e informa el motivo.',N'Elimina clientes y proveedores con confirmación y protección de su historial.',
 @now,N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',@now,NULL,1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
 WHERE version = N'5.00.466' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,
 occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.466',N'Compras y Almacenes','FIX',N'Elimina primero las partidas de tus documentos',N'OC y requisiciones consultan sus partidas actuales antes de eliminar. OC, requisiciones, entradas y salidas bloquean documentos con partidas y muestran el motivo del rechazo. Si falla la revisión, se conserva el documento.',N'Evita borrar documentos con partidas y bloqueos por contadores desactualizados.',N'Protege tus documentos: elimina primero sus partidas antes de borrar OC, requisiciones y vales.',
 @now,N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',@now,NULL,1);
END;

COMMIT TRANSACTION;
SELECT id,version,title,publicationStatus,releaseStatus FROM dbo.product_updates WHERE version IN ('5.00.465','5.00.466') AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
