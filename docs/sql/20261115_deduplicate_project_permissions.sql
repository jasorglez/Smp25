USE security;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.detailedpermissions d
    JOIN dbo.masterpermissions m ON m.id = d.master_id
    WHERE d.id = 53 AND d.identifier = N'contracts' AND m.identifier = N'projects' AND d.active = 1
) OR NOT EXISTS (
    SELECT 1 FROM dbo.detailedpermissions d
    JOIN dbo.masterpermissions m ON m.id = d.master_id
    WHERE d.id = 81 AND d.identifier = N'contracts' AND m.identifier = N'projects' AND d.active = 1
) OR NOT EXISTS (
    SELECT 1 FROM dbo.detailedpermissions d
    JOIN dbo.masterpermissions m ON m.id = d.master_id
    WHERE d.id = 54 AND d.identifier = N'concepts' AND m.identifier = N'projects' AND d.active = 1
) OR NOT EXISTS (
    SELECT 1 FROM dbo.detailedpermissions d
    JOIN dbo.masterpermissions m ON m.id = d.master_id
    WHERE d.id = 84 AND d.identifier = N'concepts' AND m.identifier = N'projects' AND d.active = 1
)
    THROW 51000, 'El catálogo de permisos de Proyectos cambió; no se aplicó la consolidación.', 1;

-- El catálogo duplicado no tenía reglas de rol asociadas al ID duplicado.
IF EXISTS (SELECT 1 FROM dbo.roledetailedpermissions WHERE id_detailed_permission IN (81, 84))
    THROW 51001, 'Hay reglas de rol nuevas asociadas a los duplicados; se requiere revisar antes de consolidar.', 1;

-- Consolida el permiso global conservando el acceso activo de cualquiera de los dos registros.
UPDATE canonical
SET active = 1
FROM dbo.userxsecuritypermissions canonical
WHERE canonical.permission_id IN (53, 54)
  AND EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions duplicate
      WHERE duplicate.user_id = canonical.user_id
        AND duplicate.permission_id = CASE canonical.permission_id WHEN 53 THEN 81 WHEN 54 THEN 84 END
        AND duplicate.active = 1
  );

DELETE duplicate
FROM dbo.userxsecuritypermissions duplicate
WHERE duplicate.permission_id IN (81, 84)
  AND EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions canonical
      WHERE canonical.user_id = duplicate.user_id
        AND canonical.permission_id = CASE duplicate.permission_id WHEN 81 THEN 53 WHEN 84 THEN 54 END
  );

UPDATE dbo.userxsecuritypermissions
SET permission_id = CASE permission_id WHEN 81 THEN 53 WHEN 84 THEN 54 END
WHERE permission_id IN (81, 84);

-- Consolida los permisos limitados por empresa; mantiene activo si cualquiera estaba activo.
UPDATE canonical
SET active = 1
FROM dbo.userxsecuritypermissions_company canonical
WHERE canonical.permission_id IN (53, 54)
  AND EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions_company duplicate
      WHERE duplicate.user_id = canonical.user_id
        AND duplicate.company_id = canonical.company_id
        AND duplicate.permission_id = CASE canonical.permission_id WHEN 53 THEN 81 WHEN 54 THEN 84 END
        AND duplicate.active = 1
  );

DELETE duplicate
FROM dbo.userxsecuritypermissions_company duplicate
WHERE duplicate.permission_id IN (81, 84)
  AND EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions_company canonical
      WHERE canonical.user_id = duplicate.user_id
        AND canonical.company_id = duplicate.company_id
        AND canonical.permission_id = CASE duplicate.permission_id WHEN 81 THEN 53 WHEN 84 THEN 54 END
  );

UPDATE dbo.userxsecuritypermissions_company
SET permission_id = CASE permission_id WHEN 81 THEN 53 WHEN 84 THEN 54 END
WHERE permission_id IN (81, 84);

-- Las tablas legacy no tenían asignaciones en los IDs duplicados, pero se remapean por seguridad.
UPDATE dbo.userxcrud
SET id_detailedpermission = CASE id_detailedpermission WHEN 81 THEN 53 WHEN 84 THEN 54 END
WHERE id_detailedpermission IN (81, 84);

UPDATE dbo.crudPremissions
SET id_detailed_permission = CASE id_detailed_permission WHEN 81 THEN 53 WHEN 84 THEN 54 END
WHERE id_detailed_permission IN (81, 84);

UPDATE dbo.detailedpermissions
SET active = 0
WHERE id IN (81, 84) AND identifier IN (N'contracts', N'concepts');

IF EXISTS (
    SELECT 1 FROM dbo.detailedpermissions
    WHERE id IN (81, 84) AND active = 1
) OR EXISTS (
    SELECT 1 FROM dbo.userxsecuritypermissions WHERE permission_id IN (81, 84)
) OR EXISTS (
    SELECT 1 FROM dbo.userxsecuritypermissions_company WHERE permission_id IN (81, 84)
)
    THROW 51002, 'La verificación posterior detectó duplicados sin consolidar.', 1;

COMMIT TRANSACTION;

SELECT id, permission_name, identifier, active
FROM dbo.detailedpermissions
WHERE id IN (53, 81, 54, 84)
ORDER BY identifier, id;
GO
