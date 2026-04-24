-- =============================================
-- SCRIPT DE CONFIGURACIÓN: CUENTAS CONTABLES
-- Sistema de Ingresos y Egresos
-- Estructura Jerárquica de 3 Niveles
-- =============================================

-- =============================================
-- 1. AGREGAR FK A TABLA EXISTENTE incomeandexpense
-- =============================================

-- Agregar columna para relacionar con cuentas contables
ALTER TABLE [dbo].[incomeandexpense]
ADD [id_cuenta_contable] INT NULL;

-- Agregar foreign key
ALTER TABLE [dbo].[incomeandexpense]
ADD CONSTRAINT FK_incomeandexpense_cuentascontables
FOREIGN KEY ([id_cuenta_contable]) REFERENCES [dbo].[cuentascontables]([id]);

-- Crear índice
CREATE NONCLUSTERED INDEX idx_incomeandexpense_cuenta
ON [dbo].[incomeandexpense]([id_cuenta_contable] ASC);

GO

-- =============================================
-- 2. DATA DE EJEMPLO PARA CUENTAS CONTABLES
-- =============================================

-- **NOTA**: Ajustar idCompany según corresponda (en este ejemplo se usa idCompany = 1)

-- ========== EGRESOS ==========

-- Nivel 1: Cuenta Mayor
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES ('5000', 'EGRESOS', 'Cuenta mayor de egresos', 1, NULL, 0, 1, 1);

-- Nivel 2: Subcuentas de Egresos
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5100', 'IMPUESTOS', 'Impuestos y contribuciones', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5200', 'NÓMINA', 'Gastos de nómina y personal', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5300', 'SERVICIOS', 'Servicios y suministros', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5400', 'ARRENDAMIENTOS', 'Rentas y arrendamientos', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5500', 'MANTENIMIENTO', 'Mantenimiento y reparaciones', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5600', 'COMBUSTIBLES', 'Combustibles y lubricantes', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5700', 'PAPELERÍA', 'Papelería y artículos de oficina', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5800', 'HONORARIOS', 'Honorarios profesionales', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1),
('5900', 'OTROS GASTOS', 'Gastos diversos', 2, (SELECT id FROM cuentascontables WHERE codigo = '5000'), 0, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - IMPUESTOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5101', 'ISR', 'Impuesto Sobre la Renta', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1),
('5102', 'IVA', 'Impuesto al Valor Agregado', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1),
('5103', 'IMSS', 'Instituto Mexicano del Seguro Social', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1),
('5104', 'INFONAVIT', 'Instituto del Fondo Nacional de la Vivienda', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1),
('5105', 'PREDIAL', 'Impuesto predial', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1),
('5106', 'TENENCIA', 'Tenencia vehicular', 3, (SELECT id FROM cuentascontables WHERE codigo = '5100'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - NÓMINA
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5201', 'SUELDOS Y SALARIOS', 'Sueldos y salarios del personal', 3, (SELECT id FROM cuentascontables WHERE codigo = '5200'), 1, 1, 1),
('5202', 'AGUINALDO', 'Aguinaldo anual', 3, (SELECT id FROM cuentascontables WHERE codigo = '5200'), 1, 1, 1),
('5203', 'PRIMA VACACIONAL', 'Prima vacacional', 3, (SELECT id FROM cuentascontables WHERE codigo = '5200'), 1, 1, 1),
('5204', 'BONOS Y COMISIONES', 'Bonos y comisiones a empleados', 3, (SELECT id FROM cuentascontables WHERE codigo = '5200'), 1, 1, 1),
('5205', 'INDEMNIZACIONES', 'Liquidaciones e indemnizaciones', 3, (SELECT id FROM cuentascontables WHERE codigo = '5200'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - SERVICIOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5301', 'LUZ', 'Energía eléctrica', 3, (SELECT id FROM cuentascontables WHERE codigo = '5300'), 1, 1, 1),
('5302', 'AGUA', 'Agua potable', 3, (SELECT id FROM cuentascontables WHERE codigo = '5300'), 1, 1, 1),
('5303', 'TELÉFONO', 'Servicio telefónico', 3, (SELECT id FROM cuentascontables WHERE codigo = '5300'), 1, 1, 1),
('5304', 'INTERNET', 'Servicio de internet', 3, (SELECT id FROM cuentascontables WHERE codigo = '5300'), 1, 1, 1),
('5305', 'GAS', 'Gas LP o natural', 3, (SELECT id FROM cuentascontables WHERE codigo = '5300'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - ARRENDAMIENTOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5401', 'RENTA DE OFICINA', 'Renta de oficinas', 3, (SELECT id FROM cuentascontables WHERE codigo = '5400'), 1, 1, 1),
('5402', 'RENTA DE BODEGA', 'Renta de bodegas', 3, (SELECT id FROM cuentascontables WHERE codigo = '5400'), 1, 1, 1),
('5403', 'RENTA DE EQUIPO', 'Renta de maquinaria y equipo', 3, (SELECT id FROM cuentascontables WHERE codigo = '5400'), 1, 1, 1),
('5404', 'RENTA DE VEHÍCULOS', 'Renta de vehículos', 3, (SELECT id FROM cuentascontables WHERE codigo = '5400'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - MANTENIMIENTO
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5501', 'MANTENIMIENTO DE EDIFICIO', 'Mantenimiento de instalaciones', 3, (SELECT id FROM cuentascontables WHERE codigo = '5500'), 1, 1, 1),
('5502', 'MANTENIMIENTO DE EQUIPO', 'Mantenimiento de maquinaria', 3, (SELECT id FROM cuentascontables WHERE codigo = '5500'), 1, 1, 1),
('5503', 'MANTENIMIENTO DE VEHÍCULOS', 'Mantenimiento de vehículos', 3, (SELECT id FROM cuentascontables WHERE codigo = '5500'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - COMBUSTIBLES
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5601', 'GASOLINA', 'Gasolina para vehículos', 3, (SELECT id FROM cuentascontables WHERE codigo = '5600'), 1, 1, 1),
('5602', 'DIESEL', 'Diesel para vehículos', 3, (SELECT id FROM cuentascontables WHERE codigo = '5600'), 1, 1, 1),
('5603', 'LUBRICANTES', 'Aceites y lubricantes', 3, (SELECT id FROM cuentascontables WHERE codigo = '5600'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - PAPELERÍA
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5701', 'PAPELERÍA', 'Papelería en general', 3, (SELECT id FROM cuentascontables WHERE codigo = '5700'), 1, 1, 1),
('5702', 'ARTÍCULOS DE LIMPIEZA', 'Productos de limpieza', 3, (SELECT id FROM cuentascontables WHERE codigo = '5700'), 1, 1, 1),
('5703', 'CONSUMIBLES', 'Consumibles de oficina', 3, (SELECT id FROM cuentascontables WHERE codigo = '5700'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - HONORARIOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5801', 'HONORARIOS CONTABLES', 'Servicios contables', 3, (SELECT id FROM cuentascontables WHERE codigo = '5800'), 1, 1, 1),
('5802', 'HONORARIOS LEGALES', 'Servicios legales', 3, (SELECT id FROM cuentascontables WHERE codigo = '5800'), 1, 1, 1),
('5803', 'HONORARIOS CONSULTORES', 'Consultorías externas', 3, (SELECT id FROM cuentascontables WHERE codigo = '5800'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - OTROS GASTOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('5901', 'PUBLICIDAD', 'Gastos de publicidad', 3, (SELECT id FROM cuentascontables WHERE codigo = '5900'), 1, 1, 1),
('5902', 'VIÁTICOS', 'Viáticos y pasajes', 3, (SELECT id FROM cuentascontables WHERE codigo = '5900'), 1, 1, 1),
('5903', 'CAPACITACIÓN', 'Cursos y capacitación', 3, (SELECT id FROM cuentascontables WHERE codigo = '5900'), 1, 1, 1),
('5904', 'SEGUROS', 'Pólizas de seguros', 3, (SELECT id FROM cuentascontables WHERE codigo = '5900'), 1, 1, 1),
('5905', 'DONACIONES', 'Donativos', 3, (SELECT id FROM cuentascontables WHERE codigo = '5900'), 1, 1, 1);

-- ========== INGRESOS ==========

-- Nivel 1: Cuenta Mayor
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES ('4000', 'INGRESOS', 'Cuenta mayor de ingresos', 1, NULL, 0, 1, 1);

-- Nivel 2: Subcuentas de Ingresos
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('4100', 'VENTAS', 'Ingresos por ventas', 2, (SELECT id FROM cuentascontables WHERE codigo = '4000'), 0, 1, 1),
('4200', 'SERVICIOS', 'Ingresos por servicios', 2, (SELECT id FROM cuentascontables WHERE codigo = '4000'), 0, 1, 1),
('4300', 'INTERESES', 'Ingresos por intereses', 2, (SELECT id FROM cuentascontables WHERE codigo = '4000'), 0, 1, 1),
('4400', 'OTROS INGRESOS', 'Otros ingresos diversos', 2, (SELECT id FROM cuentascontables WHERE codigo = '4000'), 0, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - VENTAS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('4101', 'VENTA DE PRODUCTOS', 'Venta de productos terminados', 3, (SELECT id FROM cuentascontables WHERE codigo = '4100'), 1, 1, 1),
('4102', 'VENTA DE MERCANCÍAS', 'Venta de mercancías', 3, (SELECT id FROM cuentascontables WHERE codigo = '4100'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - SERVICIOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('4201', 'SERVICIOS PROFESIONALES', 'Ingresos por servicios profesionales', 3, (SELECT id FROM cuentascontables WHERE codigo = '4200'), 1, 1, 1),
('4202', 'SERVICIOS DE CONSULTORÍA', 'Ingresos por consultorías', 3, (SELECT id FROM cuentascontables WHERE codigo = '4200'), 1, 1, 1),
('4203', 'SERVICIOS DE MANTENIMIENTO', 'Ingresos por mantenimiento', 3, (SELECT id FROM cuentascontables WHERE codigo = '4200'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - INTERESES
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('4301', 'INTERESES BANCARIOS', 'Intereses ganados en cuentas bancarias', 3, (SELECT id FROM cuentascontables WHERE codigo = '4300'), 1, 1, 1),
('4302', 'INTERESES POR INVERSIONES', 'Rendimientos de inversiones', 3, (SELECT id FROM cuentascontables WHERE codigo = '4300'), 1, 1, 1);

-- Nivel 3: Cuentas Detalle (HOJAS) - OTROS INGRESOS
INSERT INTO [dbo].[cuentascontables] (codigo, nombre, descripcion, nivel, idPadre, esHoja, activo, idCompany)
VALUES
('4401', 'RECUPERACIÓN DE SEGUROS', 'Recuperaciones de pólizas', 3, (SELECT id FROM cuentascontables WHERE codigo = '4400'), 1, 1, 1),
('4402', 'VENTA DE ACTIVOS', 'Venta de activos fijos', 3, (SELECT id FROM cuentascontables WHERE codigo = '4400'), 1, 1, 1),
('4403', 'SUBSIDIOS Y APOYOS', 'Subsidios gubernamentales', 3, (SELECT id FROM cuentascontables WHERE codigo = '4400'), 1, 1, 1);

GO

-- =============================================
-- 3. QUERY PARA VERIFICAR ESTRUCTURA JERÁRQUICA
-- =============================================

-- Ver toda la estructura en árbol
WITH CuentasTree AS (
    -- Nivel 1
    SELECT
        id,
        codigo,
        nombre,
        nivel,
        idPadre,
        esHoja,
        CAST(codigo AS VARCHAR(255)) AS path,
        CAST(nombre AS VARCHAR(255)) AS fullName
    FROM cuentascontables
    WHERE nivel = 1

    UNION ALL

    -- Niveles 2 y 3
    SELECT
        c.id,
        c.codigo,
        c.nombre,
        c.nivel,
        c.idPadre,
        c.esHoja,
        CAST(ct.path + ' > ' + c.codigo AS VARCHAR(255)),
        CAST(ct.fullName + ' > ' + c.nombre AS VARCHAR(255))
    FROM cuentascontables c
    INNER JOIN CuentasTree ct ON c.idPadre = ct.id
)
SELECT
    id,
    REPLICATE('  ', nivel - 1) + codigo AS [Código],
    REPLICATE('  ', nivel - 1) + nombre AS [Nombre],
    nivel AS [Nivel],
    CASE WHEN esHoja = 1 THEN 'Sí' ELSE 'No' END AS [Es Hoja],
    fullName AS [Ruta Completa]
FROM CuentasTree
ORDER BY path;

GO

-- =============================================
-- 4. QUERY PARA VER ACUMULADOS POR CUENTA
-- =============================================

-- Vista de acumulados (opcional - crear como vista permanente si se necesita)
WITH RECURSIVE CuentasHierarchy AS (
    -- Nivel 3 (hojas) con sus montos
    SELECT
        c.id,
        c.codigo,
        c.nombre,
        c.nivel,
        c.idPadre,
        COALESCE(SUM(e.total), 0) AS montoDirecto,
        COALESCE(SUM(e.total), 0) AS montoAcumulado
    FROM cuentascontables c
    LEFT JOIN incomeandexpense e ON c.id = e.id_cuenta_contable AND e.active = 1
    WHERE c.esHoja = 1
    GROUP BY c.id, c.codigo, c.nombre, c.nivel, c.idPadre

    UNION ALL

    -- Acumulación hacia arriba
    SELECT
        p.id,
        p.codigo,
        p.nombre,
        p.nivel,
        p.idPadre,
        0 AS montoDirecto,
        SUM(h.montoAcumulado) AS montoAcumulado
    FROM cuentascontables p
    INNER JOIN CuentasHierarchy h ON p.id = h.idPadre
    GROUP BY p.id, p.codigo, p.nombre, p.nivel, p.idPadre
)
SELECT
    codigo AS [Código],
    nombre AS [Cuenta],
    nivel AS [Nivel],
    montoDirecto AS [Monto Directo],
    montoAcumulado AS [Monto Acumulado]
FROM CuentasHierarchy
ORDER BY codigo;

-- =============================================
-- FIN DEL SCRIPT
-- =============================================
