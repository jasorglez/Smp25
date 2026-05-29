-- ================================================================
-- PMO Module Setup — Módulo PMO (id=22)
-- BD: security   |   Producción: 66.179.240.10:56969
-- Fecha: 29 Mayo 2026
-- ================================================================

USE security;
GO

-- ──────────────────────────────────────────────────────────────
-- 1. Master Permission  (id es IDENTITY → activar insert manual)
-- ──────────────────────────────────────────────────────────────
SET IDENTITY_INSERT dbo.masterpermissions ON;

INSERT INTO dbo.masterpermissions (id, permission_name, identifier, comment, active)
VALUES (22, 'PMO', 'pmo', 'Módulo PMO - Gestión y Control de Proyectos', 1);

SET IDENTITY_INSERT dbo.masterpermissions OFF;
GO

-- ──────────────────────────────────────────────────────────────
-- 2. Detailed Permissions — Submenús (master_id = 22)
-- ──────────────────────────────────────────────────────────────
-- Programa de Trabajo (árbol con avance y semáforos)
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Programa de Trabajo', 'programa', 'Árbol del programa de trabajo con barras de progreso, semáforos y filtros', 1);

-- Punto 8+11: Dashboard EVM
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Reporte PMO', 'reporte', 'Dashboard KPIs EVM: SPI, CPI, EAC, ETC, Curva S, Entregables', 1);

-- Punto 9: Recursos
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Recursos', 'recursos', 'Costos planeados vs reales por tipo de cargo', 1);

-- Punto 10: Ruta Crítica
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Ruta Crítica', 'ruta-critica', 'Ruta crítica, hitos, predecesores/sucesores', 1);

-- Punto 12: Líneas Base
INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
VALUES (22, 'Líneas Base', 'lineas-base', 'Reprogramación y control de líneas base históricas', 1);
GO

-- ──────────────────────────────────────────────────────────────
-- 3. MenuXCompany — mismas empresas que Proyectos (idMenu=8)
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
GO

-- ──────────────────────────────────────────────────────────────
-- Verificar resultado
-- ──────────────────────────────────────────────────────────────
SELECT * FROM dbo.masterpermissions    WHERE id = 22;
SELECT * FROM dbo.detailedpermissions  WHERE master_id = 22;
SELECT * FROM dbo.MenuXCompany         WHERE idMenu = 22;
GO
