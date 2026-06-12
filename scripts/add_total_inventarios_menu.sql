-- Agrega el submenu "Total Inventarios" despues de "Almacen Molienda" en Extraccion y Fermentacion
-- detailed_id = 128 (molienda_princ), master_id = 17, tab_order = 7

USE security;

INSERT INTO dbo.SubDetailedPermissions
  (master_id, detailed_id, permission_name, Identifier, description, tipo, comment, route, icon, showAsTab, tab_order, active)
VALUES
  (17, 128, 'Total Inventarios', 'totinv_prn', 'Principal', 'Principal', '', 'totalinventarios', 'bi bi-clipboard-data', 1, 7, 1);
