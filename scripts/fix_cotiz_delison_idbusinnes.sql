-- ============================================================================
-- Fix: COTIZ delison con id_businnes = 0 (empresa sin asignar)
-- ----------------------------------------------------------------------------
-- Problema: algunas COTIZ delison (type='COTIZ', type_reference='delison') se
-- guardaron con id_businnes = 0. Esto rompía el cálculo del "Anticipo OC" en
-- GetOcsByPedimento, porque la empresa se resolvía desde ese campo y el catálogo
-- de condiciones_pago quedaba vacío (TryGetValue fallaba -> anticipoOc = 0 ->
-- el botón "Registrar pago" no se mostraba).
--
-- Solución de datos: poblar id_businnes con la empresa real, resuelta desde la
-- sucursal de la REQUIS padre (smp.dbo.Branchs.id_company) — fuente confiable.
--
-- NOTA: el backend (v5.94) ya es robusto ante id_businnes=0; este script solo
-- corrige los datos históricos para mantener consistencia. NO toca datemodified
-- para no alterar el orden del grid de requisiciones.
-- ============================================================================

-- 1) PREVIEW — revisar qué se va a actualizar ANTES de ejecutar el UPDATE:
SELECT c.id, c.folio, c.id_businnes AS actual, b.id_company AS empresa_correcta,
       req.folio AS req_folio, b.name AS sucursal
FROM   warehouses.dbo.ocandreq c
JOIN   warehouses.dbo.ocandreq req ON req.id = c.id_req AND req.type = 'REQUIS'
JOIN   smp.dbo.Branchs b ON b.id = req.id_reference
WHERE  c.type = 'COTIZ' AND c.type_reference = 'delison'
   AND (c.id_businnes = 0 OR c.id_businnes IS NULL) AND c.active = 1
   AND b.id_company > 0
ORDER BY c.id;

-- 2) UPDATE — ejecutar tras validar el preview:
UPDATE c
SET    c.id_businnes = b.id_company
FROM   warehouses.dbo.ocandreq c
JOIN   warehouses.dbo.ocandreq req ON req.id = c.id_req AND req.type = 'REQUIS'
JOIN   smp.dbo.Branchs b ON b.id = req.id_reference
WHERE  c.type = 'COTIZ' AND c.type_reference = 'delison'
   AND (c.id_businnes = 0 OR c.id_businnes IS NULL) AND c.active = 1
   AND b.id_company > 0;
