-- ============================================================================
-- FASE 3 — Menú "Inventario" en Almacenes (tab) → submenú "Inventario materia prima"
-- ----------------------------------------------------------------------------
-- El menú de Almacenes es permission-driven (security.dbo.detailedpermissions,
-- master_id = 4). Este script:
--   1) Inserta el tab "Inventario" (route 'inventario', identifier 'inventario').
--   2) Replica los GRANTS de "Materia Prima" (id_detailed_permission = 11) para
--      que TODO rol/posición que ya ve Materia Prima vea también Inventario.
-- El submenú "Inventario materia prima" NO necesita permiso: está hardcodeado en
-- InventarioComponent (sub-nav). El usuario root ve el tab sin grants.
--
-- Idempotente. BD: security. Servidor PRUEBAS.
-- ============================================================================

DECLARE @master_id INT = 4;          -- master 'warehouses'
DECLARE @mat_prim  INT = 11;         -- detailed 'mat_prim' (Materia Prima) — fuente de grants
DECLARE @inv_id    INT;

-- 1) Tab "Inventario" -------------------------------------------------------
SELECT @inv_id = id FROM security.dbo.detailedpermissions
 WHERE master_id = @master_id AND identifier = 'inventario';

IF @inv_id IS NULL
BEGIN
    INSERT INTO security.dbo.detailedpermissions
        (master_id, permission_name, identifier, route, icon, showAsTab, tab_order, principal_sub_identifier, comment, active)
    VALUES
        (@master_id, 'Inventario', 'inventario', 'inventario', 'bi bi-clipboard-data', 1, 6, NULL,
         'Inventario de materia prima (almacen global)', 1);

    SET @inv_id = SCOPE_IDENTITY();
END;

-- 2) Grants: copia los de Materia Prima para (rol, posicion) que aún no tengan Inventario.
INSERT INTO security.dbo.roledetailedpermissions
    (id_role, id_posicion, id_master_permission, master_Read, id_detailed_permission, detailed_Read,
     sub_detailed_Permission, idShowPermition, can_create, can_read, can_update, can_delete,
     created_at, updated_at, aplica, active)
SELECT DISTINCT
    g.id_role, g.id_posicion, @master_id, 1, @inv_id, 1,
    'Principal', NULL, 0, 1, 0, 0,
    GETDATE(), GETDATE(), 1, 1
FROM security.dbo.roledetailedpermissions g
WHERE g.id_detailed_permission = @mat_prim
  AND g.active = 1
  AND NOT EXISTS (
      SELECT 1 FROM security.dbo.roledetailedpermissions x
      WHERE x.id_detailed_permission = @inv_id
        AND x.id_role = g.id_role
        AND x.id_posicion = g.id_posicion
  );

-- Verificación (opcional):
-- SELECT * FROM security.dbo.detailedpermissions WHERE identifier='inventario';
-- SELECT id_role, id_posicion FROM security.dbo.roledetailedpermissions WHERE id_detailed_permission=@inv_id;
