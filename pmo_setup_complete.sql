-- ================================================================
-- PMO SETUP COMPLETO — Permisos + Tabla de Recursos
-- Ejecutar en ORDEN:
--   1. Este archivo en BD: security  (permisos)
--   2. pmo_recursos_table.sql en BD: smp  (tabla recursos)
-- ================================================================
-- Fecha: 29 Mayo 2026
-- ================================================================

-- ── PARTE 1: Permisos en BD security ─────────────────────────────
USE security;
GO

-- 1.1 Master permission para PMO (si no existe)
IF NOT EXISTS (SELECT 1 FROM dbo.masterpermissions WHERE id = 22)
BEGIN
    SET IDENTITY_INSERT dbo.masterpermissions ON;
    INSERT INTO dbo.masterpermissions (id, permission_name, identifier, comment, active)
    VALUES (22, 'PMO', 'pmo', 'Módulo de Gestión de Proyectos PMO', 1);
    SET IDENTITY_INSERT dbo.masterpermissions OFF;
    PRINT 'masterpermissions id=22 (PMO) insertado.';
END
ELSE
    PRINT 'masterpermissions id=22 ya existe.';
GO

-- 1.2 Detailed permissions para cada pestaña del PMO
-- programa
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = 22 AND identifier = 'programa')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
    VALUES (22, 'Programa de Trabajo', 'programa', 'Árbol Gantt del programa de trabajo con barras de progreso', 1);
    PRINT 'detailedpermissions: programa insertado.';
END

-- reporte
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = 22 AND identifier = 'reporte')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
    VALUES (22, 'Reporte PMO', 'reporte', 'Tablero EVM: BAC, EV, PV, SPI, CPI, EAC + Curva S + Ruta Crítica', 1);
    PRINT 'detailedpermissions: reporte insertado.';
END

-- recursos
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = 22 AND identifier = 'recursos')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
    VALUES (22, 'Recursos PMO', 'recursos', 'Costos planeados vs reales por tipo de recurso', 1);
    PRINT 'detailedpermissions: recursos insertado.';
END

-- ruta-critica
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = 22 AND identifier = 'ruta-critica')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
    VALUES (22, 'Ruta Crítica', 'ruta-critica', 'Diagrama Gantt SVG con flechas de dependencias y ruta crítica en rojo', 1);
    PRINT 'detailedpermissions: ruta-critica insertado.';
END

-- lineas-base
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = 22 AND identifier = 'lineas-base')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active)
    VALUES (22, 'Líneas Base', 'lineas-base', 'Snapshots de líneas base para comparar contra plan vigente', 1);
    PRINT 'detailedpermissions: lineas-base insertado.';
END
GO

-- 1.3 MenuXCompany — activar PMO para TODAS las empresas existentes
-- (solo inserta si no existe ya para esa empresa)
INSERT INTO dbo.MenuXCompany (idCompany, idMenu, active)
SELECT DISTINCT idCompany, 22, 1
FROM dbo.MenuXCompany AS m
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.MenuXCompany
    WHERE idCompany = m.idCompany AND idMenu = 22
);
PRINT 'MenuXCompany: PMO activado para todas las empresas.';
GO

-- ── PARTE 2: Tabla pmo_recursos en BD smp ────────────────────────
USE smp;
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'pmo_recursos' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.pmo_recursos (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_project      INT             NOT NULL,
        id_company      INT             NOT NULL,
        tipo            NVARCHAR(20)    NOT NULL DEFAULT 'Personal',
        descripcion     NVARCHAR(200)   NOT NULL DEFAULT '',
        unidad          NVARCHAR(30)    NOT NULL DEFAULT 'día',
        periodo         NVARCHAR(20)    NOT NULL DEFAULT '',
        cant_plan       DECIMAL(18,4)   NOT NULL DEFAULT 0,
        cant_real       DECIMAL(18,4)   NOT NULL DEFAULT 0,
        costo_unit_plan DECIMAL(18,4)   NOT NULL DEFAULT 0,
        costo_unit_real DECIMAL(18,4)   NOT NULL DEFAULT 0,
        active          SMALLINT        NOT NULL DEFAULT 1,
        created_at      DATETIME        NOT NULL DEFAULT GETDATE()
    );
    PRINT 'Tabla pmo_recursos creada correctamente.';
END
ELSE
    PRINT 'Tabla pmo_recursos ya existe.';
GO

-- ── Verificar resultado ───────────────────────────────────────────
USE security;
SELECT id, permission_name, identifier FROM dbo.masterpermissions WHERE id = 22;
SELECT id, permission_name, identifier, active FROM dbo.detailedpermissions WHERE master_id = 22 ORDER BY id;
SELECT COUNT(*) AS empresas_con_pmo FROM dbo.MenuXCompany WHERE idMenu = 22;
GO

USE smp;
SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'pmo_recursos' ORDER BY ORDINAL_POSITION;
GO
