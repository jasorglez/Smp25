-- ================================================================
-- PMO Module Setup — Módulo PMO (id=22)
-- Ejecutar en la BD: SecurityDB (producción: 66.179.240.10:56969)
-- Fecha: 29 Mayo 2026
-- ================================================================

USE SecurityDB;  -- ajusta si el nombre de tu BD es diferente
GO

-- ──────────────────────────────────────────────────────────────
-- 1. Master Permission (id=22 — siguiente disponible)
-- ──────────────────────────────────────────────────────────────
INSERT INTO dbo.masterpermissions (id, permission_name, identifier, comment, active)
VALUES (22, 'PMO', 'pmo', 'Módulo PMO - Gestión y Control de Proyectos', 1);

-- ──────────────────────────────────────────────────────────────
-- 2. Detailed Permissions — Submenús del PMO (master_id = 22)
-- ──────────────────────────────────────────────────────────────
-- Punto 8+11: Dashboard EVM (SPI, CPI, EAC, ETC, Curva S, Entregables)
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Reporte PMO', 'reporte', 'Dashboard KPIs EVM: SPI, CPI, EAC, ETC, Curva S, Entregables', 1);

-- Punto 9: Recursos (costos planeados vs reales por tipo de cargo)
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Recursos', 'recursos', 'Costos planeados vs reales por tipo de cargo: personal, material, equipo, etc.', 1);

-- Punto 10: Ruta Crítica
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Ruta Crítica', 'ruta-critica', 'Ruta crítica, hitos y seguimiento de predecesores/sucesores', 1);

-- Punto 12: Líneas Base / Reprogramación
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Líneas Base', 'lineas-base', 'Reprogramación y control de líneas base históricas', 1);

-- ──────────────────────────────────────────────────────────────
-- 3. MenuXCompany — Mismas empresas que Proyectos (idMenu=8)
-- ──────────────────────────────────────────────────────────────
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (1,  22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (7,  22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (10, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (18, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (28, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (29, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (32, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (33, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (35, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (36, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (38, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (39, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (40, 22, 1);
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active) VALUES (41, 22, 1);

-- ──────────────────────────────────────────────────────────────
-- Verificar
-- ──────────────────────────────────────────────────────────────
SELECT * FROM dbo.masterpermissions WHERE id = 22;
SELECT * FROM dbo.detailedpermissions WHERE master_id = 22;
SELECT * FROM dbo.MenuXCompany WHERE idMenu = 22;
GO
