USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @now DATETIME2(0)=SYSUTCDATETIME();
IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK,HOLDLOCK)
 WHERE version=N'5.00.467' AND idRoot IS NULL AND idCompany IS NULL AND isActive=1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.467',N'Almacenes / Entradas / Inicio inventarios',N'FIX',N'Catálogo completo para capturar el inventario inicial',N'El selector muestra todos los materiales activos en Inicio inventarios y entradas normales, incluidos los que aún no tienen existencias. Conserva las restricciones por existencia de salidas, traspasos y ajustes.',N'Permite capturar la existencia inicial seleccionando materiales del catálogo completo.',N'Captura tu inventario inicial con todos tus materiales disponibles para seleccionar.',@now,N'America/Indiana/Indianapolis','PASSED','PRODUCTION','PUBLISHED',@now,NULL,1);
END;
IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK,HOLDLOCK)
 WHERE version=N'5.00.468' AND idRoot IS NULL AND idCompany IS NULL AND isActive=1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.468',N'Almacenes / Entradas y salidas',N'IMPROVEMENT',N'Confirmación del efecto en inventario al eliminar partidas',N'La confirmación de eliminación de partidas advierte: ¿Está seguro de eliminar esta partida? Esto afectará su inventario.',N'Permite confirmar la eliminación conociendo su efecto sobre las existencias.',N'Antes de eliminar una partida, confirma su efecto en tu inventario.',@now,N'America/Indiana/Indianapolis','PASSED','PRODUCTION','PUBLISHED',@now,NULL,1);
END;
COMMIT TRANSACTION;
SELECT id,version,title,publicationStatus,releaseStatus FROM dbo.product_updates WHERE version IN ('5.00.467','5.00.468') AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
