USE security;
GO

/* Permiso hijo para administrar el catálogo de cajas desde Cobranza. */
DECLARE @CobranzasId INT = (
    SELECT TOP (1) id
    FROM dbo.masterpermissions
    WHERE identifier = 'cobranzas'
);

IF @CobranzasId IS NULL
    THROW 51000, 'No existe el permiso maestro cobranzas.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.detailedpermissions
    WHERE master_id = @CobranzasId AND identifier = 'cajas'
)
BEGIN
    INSERT INTO dbo.detailedpermissions
        (master_id, permission_name, identifier, comment, active, [order])
    VALUES
        (@CobranzasId, N'Catálogo de Cajas', 'cajas', N'Administración del catálogo de cajas para Cobranza', 1, 16);
END;
ELSE
BEGIN
    UPDATE dbo.detailedpermissions
    SET permission_name = N'Catálogo de Cajas',
        comment = N'Administración del catálogo de cajas para Cobranza',
        active = 1
    WHERE master_id = @CobranzasId AND identifier = 'cajas';
END;
GO

USE administration;
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE version = N'5.00.493'
      AND module = N'Cobranza / Caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
        (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,
         occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,
         publishedAtUtc,createdBy,createdAtUtc,updatedAtUtc,isActive)
    VALUES
        (NULL,NULL,N'5.00.493',N'Cobranza / Caja',N'IMPROVEMENT',N'Catálogo de cajas en Cobranza',
         N'El menú de Cobranza se genera a partir de los permisos activos y muestra el nombre capturado en el catálogo de permisos. Se agrega el permiso Catálogo de Cajas y se asigna a los usuarios activos con acceso a Cobranza de la empresa 60.',
         N'Permite administrar las cajas desde Cobranza y reflejar el nombre y orden definido en permisos.',
         N'Administra tus cajas desde Cobranza con menús que respetan el nombre y orden de tus permisos.',
         SYSUTCDATETIME(),N'America/Indiana/Indianapolis',N'PENDING',N'LOCAL',N'DRAFT',NULL,NULL,
         SYSUTCDATETIME(),SYSUTCDATETIME(),1);
END;
GO

/* Asigna el permiso a los usuarios activos de la empresa 60 que ya tienen Cobranza. */
DECLARE @CompanyId INT = 60;
DECLARE @CobranzasId INT = (
    SELECT TOP (1) id
    FROM dbo.masterpermissions
    WHERE identifier = 'cobranzas'
);
DECLARE @CajasId INT = (
    SELECT TOP (1) id
    FROM dbo.detailedpermissions
    WHERE master_id = @CobranzasId AND identifier = 'cajas' AND active = 1
);

UPDATE asignacion
SET active = 1
FROM dbo.userxsecuritypermissions_company AS asignacion
JOIN dbo.Users AS usuario ON usuario.id = asignacion.user_id
WHERE usuario.id_company = @CompanyId
  AND usuario.Active = 1
  AND asignacion.company_id = @CompanyId
  AND asignacion.permission_id = @CajasId
  AND EXISTS (
      SELECT 1
      FROM dbo.userxsecuritypermissions_company AS permisoCobranza
      WHERE permisoCobranza.user_id = usuario.id
        AND permisoCobranza.company_id = @CompanyId
        AND permisoCobranza.permission_id = @CobranzasId
        AND permisoCobranza.active = 1
  );

INSERT INTO dbo.userxsecuritypermissions_company (user_id, company_id, permission_id, active)
SELECT usuario.id, @CompanyId, @CajasId, 1
FROM dbo.Users AS usuario
WHERE usuario.id_company = @CompanyId
  AND usuario.Active = 1
  AND @CajasId IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM dbo.userxsecuritypermissions_company AS permisoCobranza
      WHERE permisoCobranza.user_id = usuario.id
        AND permisoCobranza.company_id = @CompanyId
        AND permisoCobranza.permission_id = @CobranzasId
        AND permisoCobranza.active = 1
  )
  AND NOT EXISTS (
      SELECT 1
      FROM dbo.userxsecuritypermissions_company AS permisoExistente
      WHERE permisoExistente.user_id = usuario.id
        AND permisoExistente.company_id = @CompanyId
        AND permisoExistente.permission_id = @CajasId
  );
GO
