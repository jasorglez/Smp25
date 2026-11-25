/*
  BIAPP - Archivo maestro de scripts SQL
  Cada bloque conserva su fecha, módulo y ruta de origen.
  Para aplicar un cambio, ejecuta únicamente su bloque; no ejecutes el archivo
  histórico completo, porque contiene scripts de migración y publicación de
  distintas fechas que ya pudieron ejecutarse en producción.
  Agrega los scripts futuros al final con fecha, módulo y repositorio.
*/

-- ============================================================================
-- Fecha: 10/09/2026
-- Módulo: Compras
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20260910_oc_gasto_destino.sql-- ============================================================================
/* Ejecutar una sola vez. Este archivo permanece local, no se sube a Git. */

use warehouses;
/* Base Warehouse */
IF COL_LENGTH('bi2.ocandreq', 'id_incorexp') IS NULL
BEGIN
    ALTER TABLE bi2.ocandreq ADD id_incorexp INT NULL;
END;
GO


use administration;
/* Base Administration */
IF COL_LENGTH('dbo.incomeandexpense', 'accepts_oc') IS NULL
BEGIN
    ALTER TABLE dbo.incomeandexpense
    ADD accepts_oc BIT NOT NULL CONSTRAINT DF_incomeandexpense_accepts_oc DEFAULT (0);
END;
GO

/* Base Administration: relación estructurada del concepto con la partida OC. */
IF COL_LENGTH('dbo.conceptsxincorexp', 'id_oc_item') IS NULL
BEGIN
    ALTER TABLE dbo.conceptsxincorexp ADD id_oc_item INT NULL;
END;
GO
-- ============================================================================
-- Fecha: 10/09/2026
-- Módulo: Compras
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20260910_oc_impuestos_por_partida.sql-- ============================================================================
/*
  OC: IVA y retención por partida.
  Ejecutar una sola vez en la base Warehouse.
*/

use warehouses;
IF COL_LENGTH('dbo.detailsreqoc', 'iva') IS NULL
BEGIN
    ALTER TABLE dbo.detailsreqoc
    ADD iva DECIMAL(16,2) NOT NULL CONSTRAINT DF_detailsreqoc_iva DEFAULT (0);
END;
GO

IF COL_LENGTH('dbo.detailsreqoc', 'retention') IS NULL
BEGIN
    ALTER TABLE dbo.detailsreqoc
    ADD retention DECIMAL(16,2) NOT NULL CONSTRAINT DF_detailsreqoc_retention DEFAULT (0);
END;
GO

IF COL_LENGTH('bi2.ocandreq', 'iva') IS NULL
BEGIN
    ALTER TABLE bi2.ocandreq
    ADD iva DECIMAL(38,2) NOT NULL CONSTRAINT DF_ocandreq_iva DEFAULT (0);
END;
GO
-- ============================================================================
-- Fecha: 10/09/2026
-- Módulo: Compras
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20260910_proveedores_tipo_subcontratista.sql-- ============================================================================
-- No subir a Git. Ejecutado en administration.
-- El valor "Subcontratista" tiene 14 caracteres; el campo anterior admitía 12.
ALTER TABLE dbo.customers
ALTER COLUMN type_int_or_ext nvarchar(30) NULL;
GO
-- ============================================================================
-- Fecha: 10/09/2026
-- Módulo: Administración / General
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20260910_ocandreq_contract_execution_branch.sql-- ============================================================================
IF COL_LENGTH('bi2.ocandreq', 'id_contract') IS NULL ALTER TABLE bi2.ocandreq ADD id_contract INT NULL;
IF COL_LENGTH('bi2.ocandreq', 'id_branch_execution') IS NULL ALTER TABLE bi2.ocandreq ADD id_branch_execution INT NULL;
GO
-- ============================================================================
-- Fecha: 10/09/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20260910_ocandreq_id_warehouse.sql-- ============================================================================
use warehouses;
/* Ejecutar una sola vez en la base de datos warehouses. */
IF COL_LENGTH('bi2.ocandreq', 'id_warehouse') IS NULL
BEGIN
  ALTER TABLE bi2.ocandreq ADD id_warehouse INT NULL;
  ALTER TABLE bi2.ocandreq ADD CONSTRAINT FK_ocandreq_warehouse
    FOREIGN KEY (id_warehouse) REFERENCES dbo.warehouses(id);
END;
GO
-- ============================================================================
-- Fecha: 13/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261013_material_components.sql-- ============================================================================
USE warehouses;
GO

/* Componentes por material. Ejecutar una sola vez en la base warehouses. */
IF OBJECT_ID(N'dbo.materialcomponents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.materialcomponents
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_materialcomponents PRIMARY KEY,
        id_company INT NOT NULL,
        id_parent_material INT NOT NULL,
        component_name NVARCHAR(200) NOT NULL,
        quantity DECIMAL(15,4) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_materialcomponents_active DEFAULT (1),
        CONSTRAINT CK_materialcomponents_quantity CHECK (quantity > 0),
        CONSTRAINT FK_materialcomponents_parent FOREIGN KEY (id_parent_material) REFERENCES dbo.materials(id)
    );

    CREATE INDEX IX_materialcomponents_active_parent_component
        ON dbo.materialcomponents(id_company, id_parent_material, component_name)
        WHERE active = 1;
END;
GO

/* La línea de inventario apunta al componente; esta columna conserva el padre
   recibido para rastrear el desglose original. */
IF COL_LENGTH(N'dbo.Detailsinandout', N'id_parent_product') IS NULL
BEGIN
    ALTER TABLE dbo.Detailsinandout ADD id_parent_product INT NULL;
    ALTER TABLE dbo.Detailsinandout ADD CONSTRAINT FK_Detailsinandout_parent_material
        FOREIGN KEY (id_parent_product) REFERENCES dbo.materials(id);
END;
GO

IF COL_LENGTH(N'dbo.Detailsinandout', N'component_name') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD component_name NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'dbo.Detailsinandout', N'source_quantity') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD source_quantity DECIMAL(15,4) NULL;
IF COL_LENGTH(N'dbo.Detailsinandout', N'source_measure') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD source_measure NVARCHAR(30) NULL;
IF COL_LENGTH(N'dbo.Detailsinandout', N'grams_per_meter_at_movement') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD grams_per_meter_at_movement DECIMAL(15,4) NULL;
GO

IF COL_LENGTH(N'dbo.materials', N'grams_per_meter') IS NULL
    ALTER TABLE dbo.materials ADD grams_per_meter DECIMAL(15,4) NULL;
GO

ALTER TABLE dbo.Detailsinandout ALTER COLUMN id_product INT NULL;
GO
-- ============================================================================
-- Fecha: 14/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261014_inandout_transfer_origin.sql-- ============================================================================
/* Adds source and paired-movement references for warehouse transfers.
   id_warehouse remains the warehouse that owns each movement. */
IF COL_LENGTH('dbo.inandout', 'id_warehouse_origin') IS NULL
    ALTER TABLE dbo.inandout ADD id_warehouse_origin INT NULL;
GO

IF COL_LENGTH('dbo.inandout', 'id_transfer_pair') IS NULL
    ALTER TABLE dbo.inandout ADD id_transfer_pair INT NULL;
GO

IF COL_LENGTH('dbo.Detailsinandout', 'id_transfer_pair') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD id_transfer_pair INT NULL;
GO
-- ============================================================================
-- Fecha: 14/10/2026
-- Módulo: Administración / General
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261014_text_components.sql-- ============================================================================
USE warehouses;
GO

/* Convierte las relaciones a componentes de texto para bases que ya ejecutaron
   20261013_material_components.sql. Conserva las definiciones existentes. */
IF COL_LENGTH(N'dbo.materialcomponents', N'component_name') IS NULL
    ALTER TABLE dbo.materialcomponents ADD component_name NVARCHAR(200) NULL;
GO

IF COL_LENGTH(N'dbo.materialcomponents', N'id_component_material') IS NOT NULL
BEGIN
    UPDATE component
       SET component_name = COALESCE(
           NULLIF(LTRIM(RTRIM(material.description)), N''),
           NULLIF(LTRIM(RTRIM(material.insumo)), N''),
           CONCAT(N'Componente ', component.id_component_material))
      FROM dbo.materialcomponents component
      LEFT JOIN dbo.materials material ON material.id = component.id_component_material
     WHERE component.component_name IS NULL;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_materialcomponents_component')
        ALTER TABLE dbo.materialcomponents DROP CONSTRAINT FK_materialcomponents_component;
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_materialcomponents_not_self')
        ALTER TABLE dbo.materialcomponents DROP CONSTRAINT CK_materialcomponents_not_self;
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialcomponents') AND name = N'UX_materialcomponents_active_parent_component')
        DROP INDEX UX_materialcomponents_active_parent_component ON dbo.materialcomponents;
    ALTER TABLE dbo.materialcomponents DROP COLUMN id_component_material;
END;
GO

UPDATE dbo.materialcomponents
   SET component_name = CONCAT(N'Componente ', id)
 WHERE component_name IS NULL;
GO

ALTER TABLE dbo.materialcomponents ALTER COLUMN component_name NVARCHAR(200) NOT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialcomponents') AND name = N'IX_materialcomponents_active_parent_component')
    CREATE INDEX IX_materialcomponents_active_parent_component
        ON dbo.materialcomponents(id_company, id_parent_material, component_name)
        WHERE active = 1;
GO

IF COL_LENGTH(N'dbo.Detailsinandout', N'component_name') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD component_name NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.Detailsinandout', N'source_quantity') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD source_quantity DECIMAL(15,4) NULL;
IF COL_LENGTH(N'dbo.Detailsinandout', N'source_measure') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD source_measure NVARCHAR(30) NULL;
IF COL_LENGTH(N'dbo.Detailsinandout', N'grams_per_meter_at_movement') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD grams_per_meter_at_movement DECIMAL(15,4) NULL;
GO

ALTER TABLE dbo.Detailsinandout ALTER COLUMN id_product INT NULL;
GO

IF COL_LENGTH(N'dbo.materials', N'grams_per_meter') IS NULL
    ALTER TABLE dbo.materials ADD grams_per_meter DECIMAL(15,4) NULL;
GO
-- ============================================================================
-- Fecha: 15/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261015_material_unit_conversions.sql-- ============================================================================
/* Conversiones configurables entre unidades por material.
   Regla: 1 unidad origen equivale a factor unidades destino. */
IF OBJECT_ID(N'dbo.materialconversions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.materialconversions
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_materialconversions PRIMARY KEY,
        id_company INT NOT NULL,
        id_material INT NOT NULL,
        id_measure_from INT NOT NULL,
        id_measure_to INT NOT NULL,
        factor DECIMAL(18,6) NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_materialconversions_active DEFAULT (1),
        CONSTRAINT CK_materialconversions_factor CHECK (factor > 0),
        CONSTRAINT CK_materialconversions_measures CHECK (id_measure_from <> id_measure_to)
    );
END;

IF COL_LENGTH(N'dbo.Detailsinandout', N'conversion_factor_at_movement') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD conversion_factor_at_movement DECIMAL(18,6) NULL;

IF COL_LENGTH(N'dbo.Detailsinandout', N'target_measure_at_movement') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD target_measure_at_movement NVARCHAR(30) NULL;

IF COL_LENGTH(N'dbo.Detailsinandout', N'source_measure_id') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD source_measure_id INT NULL;

IF COL_LENGTH(N'dbo.Detailsinandout', N'target_measure_id_at_movement') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD target_measure_id_at_movement INT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialconversions') AND name = N'UX_materialconversions_active_direction')
    CREATE UNIQUE INDEX UX_materialconversions_active_direction
        ON dbo.materialconversions(id_company, id_material, id_measure_from)
        WHERE active = 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialconversions') AND name = N'IX_materialconversions_material')
    CREATE INDEX IX_materialconversions_material
        ON dbo.materialconversions(id_company, id_material, active);

/* Migra la parametrización anterior gramos/metro a kg -> metro cuando puede
   identificar ambas unidades en el catálogo de la empresa. */
INSERT INTO dbo.materialconversions
    (id_company, id_material, id_measure_from, id_measure_to, factor, active)
SELECT m.id_company, m.id, source_measure.id, target_measure.id,
       CONVERT(DECIMAL(18,6), 1000.0 / NULLIF(m.grams_per_meter, 0)), 1
FROM dbo.materials m
JOIN dbo.catalog source_measure ON source_measure.id = m.id_medida
CROSS APPLY
(
    SELECT TOP (1) c.id
    FROM dbo.catalog c
    WHERE c.id_company = m.id_company AND c.type = 'MEASURE' AND c.active = 1
      AND UPPER(LTRIM(RTRIM(c.description))) IN ('M', 'METRO', 'METROS')
    ORDER BY CASE UPPER(LTRIM(RTRIM(c.description))) WHEN 'M' THEN 0 WHEN 'METRO' THEN 1 ELSE 2 END, c.id
) target_measure
WHERE m.grams_per_meter > 0
  AND UPPER(LTRIM(RTRIM(source_measure.description))) IN ('KG', 'KGS', 'KILO', 'KILOS', 'KILOGRAMO', 'KILOGRAMOS')
  AND NOT EXISTS
  (
      SELECT 1 FROM dbo.materialconversions existing
      WHERE existing.id_company = m.id_company AND existing.id_material = m.id
        AND existing.id_measure_from = source_measure.id AND existing.id_measure_to = target_measure.id AND existing.active = 1
  );
GO
-- ============================================================================
-- Fecha: 20/10/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261020_root_tipo_empresa.sql-- ============================================================================
use smp;
IF COL_LENGTH(N'dbo.root', N'tipo_empresa') IS NULL
BEGIN
    ALTER TABLE dbo.root
    ADD tipo_empresa varchar(20) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_root_tipo_empresa'
      AND parent_object_id = OBJECT_ID(N'dbo.root')
)
BEGIN
    ALTER TABLE dbo.root
    ADD CONSTRAINT CK_root_tipo_empresa
    CHECK (tipo_empresa IS NULL OR tipo_empresa IN ('CONSTRUCCION', 'CLINICA', 'ESCUELAS', 'RESTAURANTES'));
END;
GO
-- ============================================================================
-- Fecha: 20/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261020_material_brands_inventory.sql-- ============================================================================
/* Asignación opcional de marcas del catálogo a materiales y su captura en movimientos.
   catalog (type = BRAND) es el catálogo maestro. Los saldos históricos conservan id_brand NULL. */
IF OBJECT_ID(N'dbo.materialbrands', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.materialbrands
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_materialbrands PRIMARY KEY,
        id_material INT NOT NULL,
        id_catalog INT NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_materialbrands_active DEFAULT (1),
        CONSTRAINT FK_materialbrands_materials FOREIGN KEY (id_material) REFERENCES dbo.materials(id),
        CONSTRAINT FK_materialbrands_catalog FOREIGN KEY (id_catalog) REFERENCES dbo.catalog(id)
    );
END;

IF COL_LENGTH(N'dbo.materialbrands', N'id_catalog') IS NULL
BEGIN
    ;THROW 51001, 'dbo.materialbrands existe con el esquema anterior. Migre sus marcas de texto a dbo.catalog (type BRAND) antes de continuar.', 1;
END;

IF COL_LENGTH(N'dbo.Detailsinandout', N'id_brand') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD id_brand INT NULL;

IF COL_LENGTH(N'dbo.Detailsinandout', N'brand_name') IS NULL
    ALTER TABLE dbo.Detailsinandout ADD brand_name NVARCHAR(120) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialbrands') AND name = N'UX_materialbrands_active_material_catalog')
    CREATE UNIQUE INDEX UX_materialbrands_active_material_catalog
        ON dbo.materialbrands(id_material, id_catalog)
        WHERE active = 1;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.materialbrands') AND name = N'IX_materialbrands_material_active')
    CREATE INDEX IX_materialbrands_material_active
        ON dbo.materialbrands(id_material, active);

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Detailsinandout_materialbrands')
    ALTER TABLE dbo.Detailsinandout DROP CONSTRAINT FK_Detailsinandout_materialbrands;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_Detailsinandout_catalog_brand')
    ALTER TABLE dbo.Detailsinandout WITH CHECK
        ADD CONSTRAINT FK_Detailsinandout_catalog_brand FOREIGN KEY (id_brand) REFERENCES dbo.catalog(id);
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Proyectos / Reportes diarios
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_dailyreport_authorizer.sql-- ============================================================================
-- Add the authorizer reference used to lock project daily reports.
USE smp;
GO

IF COL_LENGTH('dbo.dailyreport', 'id_authorize') IS NULL
BEGIN
    ALTER TABLE dbo.dailyreport ADD id_authorize INT NULL;
END;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Proyectos / Reportes diarios
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_daily_report_authorization_lock_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / Reportes diarios'
      AND title = N'Candado directo para autorización de reportes diarios'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.349', N'Proyectos / Reportes diarios', 'FIX',
        N'Candado directo para autorización de reportes diarios',
        N'El grid conserva sus columnas y desactiva la animación de filas. El candado rojo ejecuta directamente el retiro de autorización; al quedar editable, el estado muestra el candado abierto verde y se informa el resultado.',
        N'Permite distinguir el estado del reporte y retirar su autorización con un clic sin que la fila se mueva.',
        N'Consulta y cambia el estado de autorización de tus reportes diarios desde el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Candado directo para autorización de reportes diarios'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_delete_confirmation_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Confirmación antes de eliminar documentos y partidas'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.352', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'FIX',
        N'Confirmación antes de eliminar documentos y partidas',
        N'Antes de eliminar un maestro o una partida de una requisición, orden de compra, entrada o salida, el sistema pide confirmar la acción. Se conservan las validaciones que impiden borrar documentos con partidas asociadas.',
        N'Evita eliminar documentos o partidas por un clic accidental.',
        N'Confirma cada eliminación de requisiciones, órdenes de compra, entradas y salidas antes de continuar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Confirmación antes de eliminar documentos y partidas'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_entry_sort_inventory_columns_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.346', N'Almacenes / Entradas y Salidas', 'IMPROVEMENT',
        N'Ordena movimientos por ID y oculta la OC en inventarios',
        N'Los grids de Entradas y Salidas ordenan por ID descendente, dejando arriba los registros con ID más alto, sin usar la fecha como criterio. En Entradas, la columna Orden de Compra se oculta para Inicio y Ajuste de inventario según valueaddition configurado en el catálogo de movimientos de cada empresa.',
        N'Facilita encontrar los movimientos agregados más recientemente y enfoca la captura de inventario en sus campos correspondientes.',
        N'Encuentra primero tus movimientos más nuevos por ID y captura inventarios sin columnas de OC innecesarias.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET module = N'Almacenes / Entradas y Salidas',
    title = N'Ordena movimientos por ID y oculta la OC en inventarios',
    description = N'Los grids de Entradas y Salidas ordenan por ID descendente, dejando arriba los registros con ID más alto, sin usar la fecha como criterio. En Entradas, la columna Orden de Compra se oculta para Inicio y Ajuste de inventario según valueaddition configurado en el catálogo de movimientos de cada empresa.',
    userBenefit = N'Facilita encontrar los movimientos agregados más recientemente y enfoca la captura de inventario en sus campos correspondientes.',
    promoText = N'Encuentra primero tus movimientos más nuevos por ID y captura inventarios sin columnas de OC innecesarias.'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module IN (N'Almacenes / Entradas', N'Almacenes / Entradas y Salidas')
  AND title IN (N'Prioriza Entradas recientes y oculta la OC en inventarios', N'Ordena movimientos por ID y oculta la OC en inventarios')
  AND version = N'5.00.346'
  AND isActive = 1;

;WITH duplicateUpdates AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY idRoot, idCompany, version, module, title ORDER BY id) AS rowNumber
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
      AND version = N'5.00.346'
      AND isActive = 1
)
UPDATE product_update
SET isActive = 0
FROM dbo.product_updates AS product_update
INNER JOIN duplicateUpdates AS duplicate_update ON duplicate_update.id = product_update.id
WHERE duplicate_update.rowNumber > 1;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Ordena movimientos por ID y oculta la OC en inventarios'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_f10_master_detail_save_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Guarda el maestro o el detalle con F10'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.347', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'IMPROVEMENT',
        N'Guarda el maestro o el detalle con F10',
        N'F10 guarda el grid que tiene el foco: el grid maestro guarda los encabezados y el grid de detalle guarda las partidas. Antes de guardar, termina la edición activa en la celda.',
        N'Permite guardar con el teclado sin confundir los cambios del encabezado con los de sus partidas.',
        N'Presiona F10 para guardar el maestro o sus partidas, según el grid donde estés trabajando.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Guarda el maestro o el detalle con F10'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_movement_catalog_save_fix_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos de movimientos'
      AND title = N'Corrige el guardado de tipos de movimiento'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.345', N'Almacenes / Catálogos de movimientos', 'FIX',
        N'Corrige el guardado de tipos de movimiento',
        N'El formulario envía solo los campos propios del catálogo y omite identificadores temporales internos del grid al crear registros. Si la API devuelve un mensaje de error, se presenta al usuario cuando está disponible.',
        N'Evita fallos al crear tipos y ayuda a entender los errores devueltos por el servidor.',
        N'Guarda tus tipos de movimiento con un mensaje claro si la API reporta un problema.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Corrige el guardado de tipos de movimiento'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_movement_catalog_updates.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos, Entradas y Salidas'
      AND title = N'Configura el comportamiento de los movimientos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.341', N'Almacenes / Catálogos, Entradas y Salidas', 'FEATURE',
        N'Configura el comportamiento de los movimientos',
        N'En Catálogos se asigna a cada tipo de movimiento un comportamiento: normal, traspaso, inicio de inventario o ajuste de inventario. El sistema usa el valor del catálogo para aplicar las reglas del movimiento; los registros anteriores mantienen compatibilidad mientras se clasifican.',
        N'Permite elegir cómo opera cada movimiento sin depender del texto de su descripción.',
        N'Configura desde Catálogos cómo se comportan tus movimientos de almacén.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Administración / Empresas y Almacenes'
      AND title = N'Crea movimientos iniciales para cada empresa nueva'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.342', N'Administración / Empresas y Almacenes', 'FEATURE',
        N'Crea movimientos iniciales para cada empresa nueva',
        N'Al dar de alta una empresa se crean cuatro tipos de Entrada: normal, traspaso, inicio de inventario y ajuste de inventario; además crea los tipos normal y traspaso para Salidas. Cada registro guarda su comportamiento en el catálogo de la empresa.',
        N'La empresa queda lista para capturar movimientos desde que se crea.',
        N'Cada empresa nueva recibe sus tipos iniciales de Entradas y Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos, Entradas y Salidas'
      AND title = N'Usa el comportamiento configurado por empresa'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.343', N'Almacenes / Catálogos, Entradas y Salidas', 'FIX',
        N'Usa el comportamiento configurado por empresa',
        N'Las reglas de traspaso, inicio y ajuste de inventario ahora leen exclusivamente el comportamiento guardado en valueaddition. Los tipos sin valor configurado se procesan como normales.',
        N'Permite definir el comportamiento desde Catálogos sin depender del nombre del movimiento.',
        N'Define cómo opera cada movimiento con el comportamiento configurado por empresa.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title IN (
      N'Configura el comportamiento de los movimientos',
      N'Crea movimientos iniciales para cada empresa nueva',
      N'Usa el comportamiento configurado por empresa'
  )
  AND isActive = 1
ORDER BY version;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_outbound_material_stock_filter_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Materiales disponibles en la búsqueda de Salidas'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.351', N'Almacenes / Salidas', 'IMPROVEMENT',
        N'Materiales disponibles en la búsqueda de Salidas',
        N'La búsqueda muestra materiales activos con existencia positiva en el almacén seleccionado y conserva materiales de partidas guardadas para su edición. Antes de guardar, valida el saldo neto disponible por material y marca, suma las partidas repetidas y descuenta lo ya registrado en la misma salida; si no puede consultar existencias, detiene el guardado y avisa.',
        N'Evita seleccionar materiales sin saldo y bloquea salidas que dejarían existencias negativas, incluso si el material aparece en varias partidas.',
        N'En Salidas, elige materiales con existencia y evita capturar cantidades por encima del saldo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;
ELSE
BEGIN
    UPDATE dbo.product_updates
    SET version = N'5.00.351',
        changeType = 'IMPROVEMENT',
        description = N'La búsqueda muestra materiales activos con existencia positiva en el almacén seleccionado y conserva materiales de partidas guardadas para su edición. Antes de guardar, valida el saldo neto disponible por material y marca, suma las partidas repetidas y descuenta lo ya registrado en la misma salida; si no puede consultar existencias, detiene el guardado y avisa.',
        userBenefit = N'Evita seleccionar materiales sin saldo y bloquea salidas que dejarían existencias negativas, incluso si el material aparece en varias partidas.',
        promoText = N'En Salidas, elige materiales con existencia y evita capturar cantidades por encima del saldo.',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Materiales disponibles en la búsqueda de Salidas'
      AND isActive = 1;
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Materiales disponibles en la búsqueda de Salidas'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_stable_warehouse_grids_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas'
      AND title = N'Grids estables al editar documentos de almacén'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.348', N'Almacenes / Requisiciones, Órdenes de compra, Entradas y Salidas', 'FIX',
        N'Grids estables al editar documentos de almacén',
        N'Los grids conservan sus definiciones de columnas entre ciclos de pantalla. Entradas y Salidas las reconstruyen solo cuando cambia el contexto que controla qué columnas se muestran. El candado rojo ejecuta directamente la acción para retirar autorización y el estado editable muestra un candado abierto verde.',
        N'Evita el parpadeo de columnas y muestra claramente cuándo un documento está autorizado o editable.',
        N'Identifica el estado de autorización y abre el documento con un clic en el candado.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Grids estables al editar documentos de almacén'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_insert_user_email_and_authorization_updates.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL
      AND idCompany IS NULL
      AND module = N'Administración / Usuarios'
      AND title = N'Conserva el ancho de la columna Email'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'local', N'Administración / Usuarios', 'IMPROVEMENT',
        N'Conserva el ancho de la columna Email',
        N'La columna Email del grid principal de Usuarios inicia con más espacio y conserva en este navegador el ancho que el usuario elija al volver a abrir la pantalla.',
        N'Permite leer direcciones largas y mantener la vista preferida entre sesiones.',
        N'Ajusta la columna Email en Usuarios y conserva el ancho elegido al regresar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL
      AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, OC, Entradas y Salidas'
      AND title = N'Confirma las asignaciones de autorización'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'local', N'Almacenes / Requisiciones, OC, Entradas y Salidas', 'FIX',
        N'Confirma las asignaciones de autorización',
        N'Al elegir un autorizador se muestra una confirmación que recuerda guardar. Al retirar la autorización, el campo queda vacío. El candado ya no selecciona la fila y el grid dejó de animar las filas al actualizarse.',
        N'Identifica quién quedó asignado, limpia al retirar la autorización y evita el movimiento del candado en el grid.',
        N'Asigna y retira autorizaciones con confirmación clara y sin movimiento en el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;
GO


-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261021_users_can_authorize_processes.sql-- ============================================================================
use security;
IF COL_LENGTH('dbo.Users', 'canAuthorizeProcesses') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD canAuthorizeProcesses bit NOT NULL
            CONSTRAINT DF_Users_canAuthorizeProcesses DEFAULT (0) WITH VALUES;
END;
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Compras
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261021_detailsreqoc_brand.sql-- ============================================================================
/* Marca opcional por partida de requisición u orden de compra.
   Ejecutar después de 20261020_material_brands_inventory.sql. */
IF COL_LENGTH(N'dbo.detailsreqoc', N'id_brand') IS NULL
    ALTER TABLE dbo.detailsreqoc ADD id_brand INT NULL;

IF COL_LENGTH(N'dbo.detailsreqoc', N'brand_name') IS NULL
    ALTER TABLE dbo.detailsreqoc ADD brand_name NVARCHAR(120) NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_detailsreqoc_catalog_brand')
    ALTER TABLE dbo.detailsreqoc WITH CHECK
        ADD CONSTRAINT FK_detailsreqoc_catalog_brand FOREIGN KEY (id_brand) REFERENCES dbo.catalog(id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.detailsreqoc') AND name = N'IX_detailsreqoc_material_brand')
    CREATE INDEX IX_detailsreqoc_material_brand ON dbo.detailsreqoc(id_supplie, id_brand);
GO
-- ============================================================================
-- Fecha: 21/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261021_inandout_entry_source.sql-- ============================================================================
use warehouses;
/* Links each warehouse outing to the inbound voucher whose balance it consumes. */
IF COL_LENGTH(N'dbo.inandout', N'id_entry') IS NULL
    ALTER TABLE dbo.inandout ADD id_entry INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.inandout')
      AND name = N'IX_inandout_id_entry_active'
)
    CREATE INDEX IX_inandout_id_entry_active ON dbo.inandout(id_entry, active, type);
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_inventory_brand_and_transfer_source_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Inventario y Entradas'
      AND title = N'Inventario por marca y origen de traspaso'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.360', N'Almacenes / Inventario y Entradas', 'IMPROVEMENT',
        N'Inventario por marca y origen de traspaso',
        N'El inventario presenta renglones separados por marca con entradas, salidas y existencia de cada una. Al consultar un traspaso guardado, el selector toma el saldo del almacén origen. Si el proyecto no tiene OT, se oculta esa columna.',
        N'Permite revisar el saldo real de cada marca y elegir materiales disponibles en el almacén desde el que se hará el traspaso.',
        N'Consulta existencias por marca y traspasa materiales desde el almacén origen.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Inventario por marca y origen de traspaso'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_master_grid_restore_on_detail_close_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Restaurar filas maestras al cerrar el detalle'
      AND version = N'5.00.363'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.363', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Restaurar filas maestras al cerrar el detalle',
        N'Al cerrar un detalle con la X, el grid colapsa la partida abierta y restaura la altura de todas las filas maestras.',
        N'Permite volver a consultar todos los maestros después de cerrar sus detalles.',
        N'Cierra el detalle y vuelve a ver todos tus movimientos en el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Restaurar filas maestras al cerrar el detalle'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_out_inventory_behaviors_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos y Salidas'
      AND title = N'Configura inicio y ajuste de inventario en Salidas'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.344', N'Almacenes / Catálogos y Salidas', 'FEATURE',
        N'Configura inicio y ajuste de inventario en Salidas',
        N'Los catálogos de Salidas permiten asignar los comportamientos Inicio de inventario y Ajuste de inventario. En el detalle, ambos usan la captura especializada disponible en Entradas: partidas iniciales en cero, indicador de existencia y búsqueda de materiales.',
        N'Permite configurar salidas con los mismos comportamientos de inventario que entradas.',
        N'Configura inicios y ajustes de inventario también al registrar Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Configura inicio y ajuste de inventario en Salidas'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_outbound_source_material_search_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Busca materiales pendientes del vale de Entrada'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.353', N'Almacenes / Salidas', 'FIX',
        N'Busca materiales pendientes del vale de Entrada',
        N'Al seleccionar un vale de Entrada, la búsqueda de partidas también incluye sus materiales con cantidad pendiente. El sistema actualiza los saldos del vale seleccionado y muestra las piezas restantes para capturarlas en la Salida.',
        N'Permite localizar y retirar los materiales que aún quedan en el vale seleccionado.',
        N'En Salidas, encuentra los materiales pendientes del vale de Entrada que estás procesando.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Busca materiales pendientes del vale de Entrada'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_outgoing_stock_rows_detail_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Existencias disponibles directo en el detalle de Salidas'
      AND version = N'5.00.364'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.364', N'Almacenes / Salidas', 'IMPROVEMENT',
        N'Existencias disponibles directo en el detalle de Salidas',
        N'En el Consumo Normal, el grid de detalle carga una fila por material y marca con existencia positiva en el almacén. Las cantidades inician en cero y al guardar solo se envían las partidas con cantidad capturada. El selector ya no ofrece crear materiales nuevos.',
        N'Permite consultar las existencias disponibles en una sola vista y registrar solo los materiales que se retirarán.',
        N'Consulta los materiales disponibles por marca y captura solo las cantidades que vas a retirar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias disponibles directo en el detalle de Salidas'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_outgoing_visible_stock_validation_fix.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Salidas'
      AND title = N'Existencia visible y validación por marca en Salidas'
      AND version = N'5.00.365'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.365', N'Almacenes / Salidas', 'FIX',
        N'Existencia visible y validación por marca en Salidas',
        N'La columna del saldo disponible se identifica como Existencia y su encabezado queda visible. La validación de Consumo Normal usa la existencia por marca cargada en el grid, evitando rechazos por una consulta individual de stock que devuelve cero.',
        N'Permite revisar el saldo disponible y guardar cantidades que no superen la existencia del material y su marca.',
        N'Consulta la existencia por marca y guarda tus salidas con el saldo visible.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencia visible y validación por marca en Salidas'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Compras
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_po_expense_destination_quick_create_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Órdenes de compra'
      AND title = N'Crear gasto destino desde la OC'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.368', N'Almacenes / Órdenes de compra', 'FEATURE',
        N'Crear gasto destino desde la OC',
        N'Si la empresa no tiene un gasto destino disponible, desde el selector de la OC se puede crear uno indicando cuenta bancaria y tipo de gasto. El registro toma la fecha, proyecto/sucursal y referencia de la orden, queda habilitado para recibir partidas y se selecciona en la OC.',
        N'Permite continuar la captura de la orden sin salir del módulo para preparar previamente el gasto destino.',
        N'Crea y vincula el gasto destino desde tu orden de compra en unos pasos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Crear gasto destino desde la OC'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_prevent_delete_used_warehouse_catalogs_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos'
      AND title = N'Protección de catálogos en uso'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.371', N'Almacenes / Catálogos', 'FIX',
        N'Protección de catálogos en uso',
        N'Antes de borrar una Entrada o Salida, se revisan sus movimientos guardados en los almacenes de la empresa; antes de borrar una Marca, se revisa si está asignada a materiales. Si está en uso, el sistema explica la referencia y cancela el borrado. Si no se puede comprobar el uso por un error de consulta, también bloquea la operación.',
        N'Evita perder catálogos que todavía se necesitan para consultar movimientos o materiales.',
        N'Conserva tus catálogos de almacén mientras tengan movimientos o materiales relacionados.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Protección de catálogos en uso'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Proyectos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_project_forecast_date_defaults_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / Proyectos'
      AND title = N'Fechas predeterminadas de pronóstico al crear proyectos'
      AND version = N'5.00.367'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.367', N'Proyectos / Proyectos', 'IMPROVEMENT',
        N'Fechas predeterminadas de pronóstico al crear proyectos',
        N'Al crear un proyecto, Pronóstico LPO toma el primer día del mes actual, Pronóstico TTT el 31 de diciembre del año actual y Clasificación inicia en Terrestre. Al editar, las fechas y clasificación guardadas se mantienen.',
        N'Ahorra captura de datos y prepara el periodo del pronóstico desde el alta del proyecto.',
        N'Crea proyectos con sus fechas de pronóstico y clasificación iniciales listas para revisar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Fechas predeterminadas de pronóstico al crear proyectos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_replenish_stock_rows_when_unlocked_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Completar existencias en movimientos editables'
      AND version = N'5.00.366'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.366', N'Almacenes / Entradas y Salidas', 'IMPROVEMENT',
        N'Completar existencias en movimientos editables',
        N'Al reabrir un movimiento editable, el detalle conserva sus partidas guardadas y agrega los materiales y marcas con existencia que aún no están en el documento, con cantidad cero. Si el movimiento está autorizado, no se agregan renglones de existencia.',
        N'Permite completar o corregir un movimiento sin volver a capturar partidas guardadas; los documentos autorizados conservan su detalle.',
        N'Reabre un movimiento editable y encuentra los saldos que aún puedes capturar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Completar existencias en movimientos editables'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_stock_catalog_grid_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Búsqueda y catálogo completo por marca'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.361', N'Almacenes / Entradas', 'IMPROVEMENT',
        N'Búsqueda y catálogo completo por marca',
        N'En Traspasos y Ajustes se puede buscar un material con el combo habitual o abrir el catálogo completo en un grid. El grid presenta materiales por marca, existencia disponible y una columna amplia para leer descripciones largas; solo agrega partidas con cantidades mayores que cero.',
        N'Facilita capturar materiales con descripciones extensas y revisar todos los saldos por marca en una sola vista.',
        N'Busca un material o consulta el catálogo completo con su existencia por marca.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Búsqueda y catálogo completo por marca'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_stock_picker_by_brand_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Selector de materiales por marca y existencia'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.359', N'Almacenes / Entradas', 'IMPROVEMENT',
        N'Selector de materiales por marca y existencia',
        N'En Traspasos y Ajustes, el selector muestra una opción por material y marca con su existencia disponible. La columna Marca tiene más espacio y la búsqueda también encuentra marcas.',
        N'Permite elegir la marca correcta y revisar su saldo antes de capturar la partida.',
        N'Elige materiales por marca y consulta el saldo disponible de cada una.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Selector de materiales por marca y existencia'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_traceability_grid_font_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Trazabilidad de materiales'
      AND title = N'Tipografía compacta en Trazabilidad de materiales'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.357', N'Almacenes / Trazabilidad de materiales', 'IMPROVEMENT',
        N'Tipografía compacta en Trazabilidad de materiales',
        N'Se redujo un punto el tamaño de letra del grid.',
        N'Facilita revisar más información del grid en pantalla.',
        N'Consulta más datos de trazabilidad con una vista más compacta.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Tipografía compacta en Trazabilidad de materiales'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_transfer_catalog_behavior_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Traspasos según el comportamiento del catálogo'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.354', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Traspasos según el comportamiento del catálogo',
        N'El backend reconoce y mantiene los traspasos con el valor TRANSFER configurado en el catálogo activo de Entradas de la empresa. El filtro de partidas consulta las existencias del almacén origen y el guardado crea el movimiento pareado para el destino.',
        N'Permite configurar el comportamiento del traspaso por empresa desde el catálogo y mover solo materiales con existencia en el almacén origen.',
        N'Configura TRASPASO en el catálogo y controla el almacén origen y destino en un solo movimiento.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Traspasos según el comportamiento del catálogo'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_transfer_detail_refresh_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Búsqueda de materiales para traspasos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.355', N'Almacenes / Entradas', 'FIX',
        N'Búsqueda de materiales para traspasos',
        N'Al cambiar el tipo de movimiento con las partidas abiertas, el detalle se vuelve a cargar usando el valueAddition del catálogo. En los traspasos solo aparecen materiales existentes con disponibilidad en el almacén origen y se oculta la opción para agregar un material nuevo.',
        N'Mantiene la búsqueda alineada con el tipo de movimiento seleccionado y evita capturar materiales nuevos en un traspaso.',
        N'En los traspasos, elige solo materiales con existencia en el almacén origen.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Búsqueda de materiales para traspasos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_transfer_stock_picker_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

UPDATE dbo.product_updates
SET version = N'5.00.356',
    title = N'Existencias visibles en ajustes y traspasos',
    description = N'Ajustes de inventario y Traspasos filtran los materiales usando valueAddition del movimiento y el stock neto del almacén seleccionado arriba del grid. El buscador por código o descripción muestra la existencia disponible y permite elegir solo materiales con existencia positiva.',
    userBenefit = N'Evita capturar materiales sin existencia y permite confirmar el saldo disponible antes de ajustar o traspasar.',
    promoText = N'Consulta el saldo del almacén mientras eliges materiales para ajustes y traspasos.',
    updatedAtUtc = @nowUtc
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Almacenes / Entradas'
  AND title = N'Existencias visibles al elegir materiales para traspasos'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias visibles en ajustes y traspasos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.356', N'Almacenes / Entradas', 'FIX',
        N'Existencias visibles en ajustes y traspasos',
        N'Ajustes de inventario y Traspasos filtran los materiales usando valueAddition del movimiento y el stock neto del almacén seleccionado arriba del grid. El buscador por código o descripción muestra la existencia disponible y permite elegir solo materiales con existencia positiva.',
        N'Evita capturar materiales sin existencia y permite confirmar el saldo disponible antes de ajustar o traspasar.',
        N'Consulta el saldo del almacén mientras eliges materiales para ajustes y traspasos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias visibles en ajustes y traspasos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_transfer_stock_warehouse_brand_fix.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias correctas por almacén y marca en traspasos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.358', N'Almacenes / Entradas', 'FIX',
        N'Existencias correctas por almacén y marca en traspasos',
        N'Los materiales para ajustes y traspasos consultan la existencia con el endpoint de stock por almacén. En un traspaso, una entrada al almacén destino ya no se suma como existencia del almacén origen. La existencia por marca se vuelve a consultar al seleccionar la marca.',
        N'Muestra los materiales disponibles en el almacén correcto y evita saldos inflados por traspasos dirigidos a otro almacén.',
        N'Consulta las existencias por almacén y marca antes de capturar un ajuste o traspaso.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias correctas por almacén y marca en traspasos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_warehouse_brand_catalog_tab_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

UPDATE dbo.product_updates
SET isActive = 0
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.369'
  AND title = N'Catálogo de Marcas en Almacenes'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos'
      AND title = N'Marcas junto a los catálogos de movimientos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.370', N'Almacenes / Catálogos', 'FIX',
        N'Marcas junto a los catálogos de movimientos',
        N'En /warehousesTD/catalogs se agregó la pestaña Marcas entre Entradas y Salidas. Desde ahí se pueden consultar, agregar y editar las marcas de la empresa mediante el catálogo BRAND.',
        N'Permite administrar las marcas desde la misma pantalla de catálogos que ya se usa para configurar los movimientos del almacén.',
        N'Administra las marcas de tus materiales junto a los catálogos de Entradas y Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Marcas junto a los catálogos de movimientos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261022_insert_warehouse_stock_rows_in_detail_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

-- The earlier modal catalog was replaced by automatic rows in the existing detail grid.
UPDATE dbo.product_updates
SET isActive = 0,
    updatedAtUtc = @nowUtc
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Almacenes / Entradas'
  AND title = N'Búsqueda y catálogo completo por marca'
  AND isActive = 1;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas'
      AND title = N'Existencias por marca directo en el detalle'
      AND version = N'5.00.362'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.362', N'Almacenes / Entradas', 'FIX',
        N'Existencias por marca directo en el detalle',
        N'En Ajustes de inventario y Traspasos, las combinaciones de material y marca con existencia positiva se cargan automáticamente en el grid de detalles del almacén origen. La cantidad por capturar inicia en cero y al guardar solo se envían las partidas con cantidad mayor que cero. El cálculo agrupa entradas y salidas por material y marca como Inventarios, evitando una consulta individual de stock por cada combinación y mostrando un indicador mientras se cargan los datos.',
        N'Muestra las mismas existencias que Inventarios, reduce consultas repetidas y avisa mientras prepara las partidas para capturar directamente en el detalle.',
        N'Abre un Ajuste o Traspaso, mira cómo se cargan sus existencias y captura las cantidades en el mismo grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Existencias por marca directo en el detalle'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_dashboard_ranking_movements_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Dashboard / Administración'
      AND title = N'Detalle de movimientos desde los rankings'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.376', N'Dashboard / Administración', 'FEATURE',
        N'Detalle de movimientos desde los rankings',
        N'Las filas de Top Clientes y Top Proveedores / Empleados se pueden abrir para consultar sus movimientos del mismo periodo seleccionado, con fecha, documento, descripción, cantidad e importe en un panel lateral.',
        N'Permite revisar el origen de los totales del ranking sin salir del dashboard.',
        N'Abre un cliente o proveedor y consulta sus movimientos y totales directamente desde el dashboard.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Dashboard / Administración'
  AND title = N'Detalle de movimientos desde los rankings'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_kardex_materials_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Kardex'
      AND title = N'Historial Kardex por material'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.373', N'Almacenes / Kardex', 'FEATURE',
        N'Historial Kardex por material',
        N'Se agregó la vista Kardex con historial cronológico de entradas, salidas, traspasos y ajustes, saldo acumulado por material, marca y almacén, y filtros de material, almacén y fechas. Desde el grid de Materiales se puede abrir el Kardex filtrado para ese producto.',
        N'Permite revisar el recorrido y el saldo de un material desde un solo lugar, o consultar movimientos de varios materiales con filtros.',
        N'Consulta el historial y saldo de tus materiales por almacén, marca y periodo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Historial Kardex por material'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_ot_manual_area_quick_create_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Proyectos / OT manuales'
      AND title = N'Crear áreas desde el selector de OT manuales'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.377', N'Proyectos / OT manuales', 'FEATURE',
        N'Crear áreas desde el selector de OT manuales',
        N'En el selector de Área se agregó “Agregar nueva Área”. El usuario puede crearla desde el grid; se guarda en el catálogo de la empresa, se recarga en las opciones y queda seleccionada en la OT activa.',
        N'Permite registrar y usar áreas nuevas sin salir del histórico de OT manuales.',
        N'Agrega un área desde el selector y úsala de inmediato en tu OT.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Proyectos / OT manuales'
  AND title = N'Crear áreas desde el selector de OT manuales'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Proyectos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_project_movement_folio_fix_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Consecutivos independientes por proyecto'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.374', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Consecutivos independientes por proyecto',
        N'La consulta de configuración de folios ahora elige de forma determinista la fila activa y la creación reutiliza una configuración existente para evitar duplicados. Se consolidaron los consecutivos de Entradas y Salidas con los folios usados y se completaron prefijos faltantes para proyectos revisados.',
        N'Evita que varios proyectos compartan o pierdan el avance del consecutivo y conserva la continuidad de los folios existentes.',
        N'Cada proyecto conserva sus folios de Entrada y Salida sin repetir números.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Consecutivos independientes por proyecto'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Proyectos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_project_movement_folio_priority_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Entradas y Salidas'
      AND title = N'Consecutivo de movimiento por proyecto'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.372', N'Almacenes / Entradas y Salidas', 'FIX',
        N'Consecutivo de movimiento por proyecto',
        N'Al generar un folio, se consulta primero la configuración del proyecto guardado en la fila; la configuración de sucursal se usa solo cuando la fila no tiene proyecto. La selección de empresa, sucursal y proyecto queda registrada en consola para facilitar el diagnóstico si falta el prefijo.',
        N'Mantiene los consecutivos separados por proyecto aunque el usuario tenga varios proyectos o también tenga una sucursal seleccionada.',
        N'Cada proyecto conserva su propio consecutivo para entradas y salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Consecutivo de movimiento por proyecto'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Plataforma / Frontend
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261023_insert_vercel_angular21_dependency_fix_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Plataforma / Deploy Vercel'
      AND title = N'Dependencias compatibles para deploy Vercel'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.375', N'Plataforma / Deploy Vercel', 'FIX',
        N'Dependencias compatibles para deploy Vercel',
        N'Se alinearon las versiones del framework Angular 21 en package.json y package-lock.json. Se actualizaron AngularFire y ng-apexcharts a versiones compatibles con Angular 21 y se renovaron sus dependencias de Firebase y ApexCharts.',
        N'Permite que Vercel instale las dependencias y compile la aplicación sin el conflicto ERESOLVE.',
        N'Prepara una instalación limpia y un deploy de Vercel sin conflictos de Angular.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title = N'Dependencias compatibles para deploy Vercel'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/10/2026
-- Módulo: Proyectos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261023_fix_project_movement_prefix_setup.sql-- ============================================================================
SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Alcance limitado: solo proyectos activos asignados a la empresa 10.
;WITH company10_projects AS
(
    SELECT DISTINCT p.id
    FROM smp.dbo.projects p
    JOIN smp.dbo.contracts c ON c.id = p.id_contrato
    JOIN smp.dbo.branchs b ON b.id = c.id_branch
    WHERE b.id_company = 10 AND p.active = 1
), active_rows AS
(
    SELECT
        ps.id,
        ps.type,
        ps.id_project_or_branch,
        MIN(ps.id) OVER (PARTITION BY ps.type, ps.id_project_or_branch) AS keeper_id,
        MAX(ISNULL(ps.consecutive_entry, 0)) OVER (PARTITION BY ps.type, ps.id_project_or_branch) AS max_entry,
        MAX(ISNULL(ps.consecutive_out, 0)) OVER (PARTITION BY ps.type, ps.id_project_or_branch) AS max_out
    FROM dbo.prefix_setup ps
    JOIN company10_projects p ON p.id = ps.id_project_or_branch
    WHERE ps.type = 'project' AND ps.active = 1
), folio_maxima AS
(
    SELECT
        p.id AS project_id,
        MAX(CASE WHEN UPPER(m.type) = 'IN'
            THEN TRY_CONVERT(int, RIGHT(LTRIM(RTRIM(m.folio)), PATINDEX('%[^0-9]%', REVERSE(LTRIM(RTRIM(m.folio))) + 'X') - 1)) END) AS used_entry,
        MAX(CASE WHEN UPPER(m.type) = 'OUT'
            THEN TRY_CONVERT(int, RIGHT(LTRIM(RTRIM(m.folio)), PATINDEX('%[^0-9]%', REVERSE(LTRIM(RTRIM(m.folio))) + 'X') - 1)) END) AS used_out
    FROM company10_projects p
    LEFT JOIN dbo.inandout m ON m.id_project = p.id
    GROUP BY p.id
)
UPDATE keeper
SET consecutive_entry = CASE WHEN fm.used_entry > ar.max_entry THEN fm.used_entry ELSE ar.max_entry END,
    consecutive_out = CASE WHEN fm.used_out > ar.max_out THEN fm.used_out ELSE ar.max_out END
FROM dbo.prefix_setup keeper
JOIN active_rows ar ON ar.keeper_id = keeper.id AND ar.id = keeper.id
LEFT JOIN folio_maxima fm ON fm.project_id = ar.id_project_or_branch;

-- Conserva la fila activa más antigua por proyecto y desactiva solo duplicados de empresa 10.
;WITH company10_projects AS
(
    SELECT DISTINCT p.id
    FROM smp.dbo.projects p
    JOIN smp.dbo.contracts c ON c.id = p.id_contrato
    JOIN smp.dbo.branchs b ON b.id = c.id_branch
    WHERE b.id_company = 10 AND p.active = 1
), ranked AS
(
    SELECT ps.id, ROW_NUMBER() OVER (PARTITION BY ps.type, ps.id_project_or_branch ORDER BY ps.id) AS row_num
    FROM dbo.prefix_setup ps
    JOIN company10_projects p ON p.id = ps.id_project_or_branch
    WHERE ps.type = 'project' AND ps.active = 1
)
UPDATE ps SET active = 0
FROM dbo.prefix_setup ps
JOIN ranked r ON r.id = ps.id
WHERE r.row_num > 1;

-- Completa prefijos predeterminados en los proyectos activos de empresa 10 sin configuración.
;WITH company10_projects AS
(
    SELECT DISTINCT p.id
    FROM smp.dbo.projects p
    JOIN smp.dbo.contracts c ON c.id = p.id_contrato
    JOIN smp.dbo.branchs b ON b.id = c.id_branch
    WHERE b.id_company = 10 AND p.active = 1
)
INSERT INTO dbo.prefix_setup
    (id_project_or_branch, type, prefix_req, consecutive_req, prefix_oc, consecutive_oc,
     prefix_entry, consecutive_entry, prefix_out, consecutive_out, active)
SELECT p.id, 'project', 'RQ-', 0, 'OC-', 0, 'EN-', 0, 'SA-', 0, 1
FROM company10_projects p
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.prefix_setup ps
    WHERE ps.id_project_or_branch = p.id AND ps.type = 'project' AND ps.active = 1
);

COMMIT TRANSACTION;

SELECT p.id AS project_id, p.name AS project_name,
       ps.id AS setup_id, ps.prefix_entry, ps.consecutive_entry,
       ps.prefix_out, ps.consecutive_out, ps.active AS setup_active
FROM smp.dbo.projects p
JOIN smp.dbo.contracts c ON c.id = p.id_contrato
JOIN smp.dbo.branchs b ON b.id = c.id_branch
LEFT JOIN dbo.prefix_setup ps ON ps.id_project_or_branch = p.id AND ps.type = 'project' AND ps.active = 1
WHERE b.id_company = 10 AND p.active = 1
ORDER BY p.id;
GO
-- ============================================================================
-- Fecha: 24/10/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261024_insert_saldos_latest_movements_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Administración / Palacio Municipal / Saldos'
      AND title = N'Mostrar primero los movimientos recientes en Saldos'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.378', N'Administración / Palacio Municipal / Saldos', 'IMPROVEMENT',
        N'Mostrar primero los movimientos recientes en Saldos',
        N'El grid de movimientos muestra primero las fechas más recientes y continúa en orden descendente. El cálculo cronológico del saldo acumulado y el orden del PDF se conservan.',
        N'Permite localizar de inmediato los movimientos más nuevos sin alterar los saldos ni el reporte.',
        N'Consulta primero los movimientos recientes de cada cuenta en Saldos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Administración / Palacio Municipal / Saldos'
  AND title = N'Mostrar primero los movimientos recientes en Saldos'
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 25/10/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261025_upsert_sales_quotes_close_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @module NVARCHAR(120) = N'Ventas / Cotizaciones';
DECLARE @title NVARCHAR(180) = N'Cierre confiable de partidas y PDF en Cotizaciones';
DECLARE @version NVARCHAR(40) = N'5.00.392';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'FIX',
        description = N'La X de partidas y PDF localiza la cotización por su ID, cierra el detalle y restaura la lista maestra.',
        userBenefit = N'Permite salir del detalle y volver al listado de cotizaciones con menos demora.',
        promoText = N'Cierra partidas o PDF y vuelve al listado de cotizaciones con la X.',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1;
END
ELSE
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, @version, @module, 'FIX', @title,
        N'La X de partidas y PDF localiza la cotización por su ID, cierra el detalle y restaura la lista maestra.',
        N'Permite salir del detalle y volver al listado de cotizaciones con menos demora.',
        N'Cierra partidas o PDF y vuelve al listado de cotizaciones con la X.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = @module AND title = @title AND version = @version
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 27/10/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261027_upsert_security_user_permissions_updates.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @updates TABLE
(
    version NVARCHAR(40),
    module NVARCHAR(120),
    changeType VARCHAR(20),
    title NVARCHAR(180),
    description NVARCHAR(MAX),
    userBenefit NVARCHAR(600),
    promoText NVARCHAR(600),
    occurredAtUtc DATETIME2(0)
);

INSERT INTO @updates
    (version, module, changeType, title, description, userBenefit, promoText, occurredAtUtc)
VALUES
    (N'5.00.396', N'Seguridad / Usuarios', 'FEATURE', N'Permisos maestros por empresa',
     N'El detalle de empresas de cada usuario permite consultar y editar los permisos maestros habilitados para cada empresa; los permisos CRUD por sucursal continúan disponibles.',
     N'Permite administrar los permisos desde el detalle de empresas del usuario y mantenerlos asociados a cada empresa.',
     N'Administra los permisos maestros de cada empresa desde el detalle de usuarios.', '2026-10-27T14:35:00'),
    (N'5.00.398', N'Seguridad / Usuarios', 'IMPROVEMENT', N'Más espacio para permisos maestros por empresa',
     N'El panel expandido de permisos maestros ahora tiene más altura para consultar y administrar más permisos a la vez.',
     N'Da más espacio vertical al listado de permisos dentro del detalle de empresa.',
     N'Consulta más permisos maestros a la vez desde el detalle de la empresa.', '2026-10-27T14:52:00'),
    (N'5.00.402', N'Seguridad / Usuarios', 'FIX', N'Volver a todos los usuarios desde cualquier detalle',
     N'La X cierra cualquier vista expandida, incluidos Permisos/Sucursales y Empresas, y restaura el listado completo de usuarios.',
     N'Permite regresar al listado completo sin quedarse filtrado en un usuario.',
     N'Cierra cualquier detalle con la X y vuelve a todos los usuarios.', '2026-10-27T16:14:00');

UPDATE target
SET changeType = source.changeType,
    description = source.description,
    userBenefit = source.userBenefit,
    promoText = source.promoText,
    occurredAtUtc = source.occurredAtUtc,
    displayTimeZone = N'America/Indiana/Indianapolis',
    validationStatus = 'PENDING',
    releaseStatus = 'LOCAL',
    publicationStatus = 'PUBLISHED',
    publishedAtUtc = COALESCE(target.publishedAtUtc, @nowUtc),
    updatedAtUtc = @nowUtc
FROM dbo.product_updates AS target
JOIN @updates AS source
  ON target.idRoot IS NULL
 AND target.idCompany IS NULL
 AND target.version = source.version
 AND target.module = source.module
 AND target.title = source.title
 AND target.isActive = 1;

INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
     createdBy, isActive)
SELECT NULL, NULL, source.version, source.module, source.changeType, source.title,
       source.description, source.userBenefit, source.promoText, source.occurredAtUtc,
       N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
       NULL, 1
FROM @updates AS source
WHERE NOT EXISTS
(
    SELECT 1 FROM dbo.product_updates AS target
    WHERE target.idRoot IS NULL
      AND target.idCompany IS NULL
      AND target.version = source.version
      AND target.module = source.module
      AND target.title = source.title
      AND target.isActive = 1
);

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version IN (N'5.00.396', N'5.00.398', N'5.00.402')
  AND module = N'Seguridad / Usuarios' AND isActive = 1
ORDER BY version;
GO
-- ============================================================================
-- Fecha: 02/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261102_upsert_telegram_morning_summary_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @version NVARCHAR(40) = N'5.00.412';
DECLARE @module NVARCHAR(120) = N'Telegram / Resumen matutino';
DECLARE @title NVARCHAR(180) = N'Resumen matutino personalizable en Telegram';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = @version
      AND module = @module
      AND title = @title
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'IMPROVEMENT',
        description = N'Cada usuario puede activar o pausar el resumen, elegir si incluye ventas y mesas abiertas, y pedirlo al momento con botones.',
        userBenefit = N'Recibe únicamente la información que necesita y consulta el resumen cuando quiera.',
        promoText = N'Personaliza tu resumen de restaurante en Telegram y consúltalo con un toque.',
        occurredAtUtc = '2026-11-02T15:57:00',
        displayTimeZone = N'America/Indiana/Indianapolis',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'DRAFT',
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = @version
      AND module = @module
      AND title = @title
      AND isActive = 1;
END
ELSE
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, @version, @module, 'IMPROVEMENT', @title,
        N'Cada usuario puede activar o pausar el resumen, elegir si incluye ventas y mesas abiertas, y pedirlo al momento con botones.',
        N'Recibe únicamente la información que necesita y consulta el resumen cuando quiera.',
        N'Personaliza tu resumen de restaurante en Telegram y consúltalo con un toque.',
        '2026-11-02T15:57:00', N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'DRAFT', NULL,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = @version AND module = @module AND title = @title
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 10/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261110_upsert_user_project_order_permissions_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();
DECLARE @module NVARCHAR(120) = N'Seguridad / Usuarios / Proyectos y órdenes';
DECLARE @title NVARCHAR(180) = N'Permisos de órdenes anidados bajo cada proyecto';
DECLARE @version NVARCHAR(40) = N'5.00.445';

IF EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1
)
BEGIN
    UPDATE dbo.product_updates
    SET changeType = 'FIX',
        description = N'La columna Proyecto se reduce y Órdenes conserva el botón con icono y contador del resto de permisos. Permite desplegar las órdenes de cada proyecto para asignar o quitar permisos al usuario.',
        userBenefit = N'Administra las asignaciones de órdenes desde el proyecto del usuario, manteniendo la navegación habitual de permisos.',
        promoText = N'Asigna órdenes al usuario desde cada proyecto con el mismo esquema de iconos y contadores.',
        validationStatus = 'PASSED',
        releaseStatus = 'LOCAL',
        publicationStatus = 'PUBLISHED',
        publishedAtUtc = COALESCE(publishedAtUtc, @nowUtc),
        updatedAtUtc = @nowUtc
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = @module
      AND title = @title
      AND version = @version
      AND isActive = 1;
END
ELSE
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, @version, @module, 'FIX', @title,
        N'La columna Proyecto se reduce y Órdenes conserva el botón con icono y contador del resto de permisos. Permite desplegar las órdenes de cada proyecto para asignar o quitar permisos al usuario.',
        N'Administra las asignaciones de órdenes desde el proyecto del usuario, manteniendo la navegación habitual de permisos.',
        N'Asigna órdenes al usuario desde cada proyecto con el mismo esquema de iconos y contadores.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = @module AND title = @title AND version = @version
  AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 12/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261112_publish_deletion_protection_updates.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @now DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
 WHERE version = N'5.00.465' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,
 occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.465',N'Administración / Clientes y proveedores','FIX',N'Protección al eliminar clientes y proveedores',N'Solicita confirmación antes de eliminar. Bloquea proveedores con movimientos administrativos o entradas vinculadas a sus OC y clientes con ingresos, egresos, ventas o créditos, incluyendo historial. Si falla la validación, conserva el registro. Requiere publicar el backend de Administración.',N'Evita eliminar clientes y proveedores con datos relacionados e informa el motivo.',N'Elimina clientes y proveedores con confirmación y protección de su historial.',
 @now,N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',@now,NULL,1);
END;

IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
 WHERE version = N'5.00.466' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
 INSERT INTO dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,
 occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.466',N'Compras y Almacenes','FIX',N'Elimina primero las partidas de tus documentos',N'OC y requisiciones consultan sus partidas actuales antes de eliminar. OC, requisiciones, entradas y salidas bloquean documentos con partidas y muestran el motivo del rechazo. Si falla la revisión, se conserva el documento.',N'Evita borrar documentos con partidas y bloqueos por contadores desactualizados.',N'Protege tus documentos: elimina primero sus partidas antes de borrar OC, requisiciones y vales.',
 @now,N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',@now,NULL,1);
END;

COMMIT TRANSACTION;
SELECT id,version,title,publicationStatus,releaseStatus FROM dbo.product_updates WHERE version IN ('5.00.465','5.00.466') AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_add_detailed_permission_order.sql-- ============================================================================
use security;
/* Complemento: orden configurable de permisos detallados (submódulos). */
IF COL_LENGTH(N'dbo.detailedpermissions', N'order') IS NULL
BEGIN
    ALTER TABLE dbo.detailedpermissions
        ADD [order] INT NOT NULL
            CONSTRAINT DF_detailedpermissions_order DEFAULT (10000) WITH VALUES;
END;
GO

/* Mantiene primero los registros nuevos existentes y deja los demás al final. */
UPDATE dbo.detailedpermissions
SET [order] = 10000
WHERE [order] = 0;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_add_master_permission_order.sql-- ============================================================================
use security ;

/* Agrega el orden configurable de los módulos principales. */
IF COL_LENGTH(N'dbo.masterpermissions', N'order') IS NULL
BEGIN
    ALTER TABLE dbo.masterpermissions
        ADD [order] INT NOT NULL
            CONSTRAINT DF_masterpermissions_order DEFAULT (10000) WITH VALUES;
END;
GO

/* Mantiene el orden visual actual como base para que el cambio sea gradual. */
UPDATE dbo.masterpermissions
SET [order] = CASE identifier
    WHEN 'dashboard' THEN 10
    WHEN 'administration' THEN 20
    WHEN 'cobranzas' THEN 30
    WHEN 'red' THEN 40
    WHEN 'municipio' THEN 50
    WHEN 'indicators' THEN 60
    WHEN 'shopping' THEN 70
    WHEN 'shoppingDelison' THEN 80
    WHEN 'shoppingTD' THEN 90
    WHEN 'warehouses' THEN 100
    WHEN 'warehousesTD' THEN 110
    WHEN 'maintenance' THEN 120
    WHEN 'hr' THEN 130
    WHEN 'sales' THEN 140
    WHEN 'projects' THEN 150
    WHEN 'preciosunitarios' THEN 160
    WHEN 'pmo' THEN 170
    WHEN 'presupuestos' THEN 180
    WHEN 'setup' THEN 190
    ELSE [order]
END;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_caja_turnos.sql-- ============================================================================
USE administration;
GO

/* Reutiliza pv.cajero_turnos y las tiendas/cajas existentes para aperturas.
   Los abonos cobrados en el negocio quedan ligados al turno; los de domicilio
   conservan NULL para poder manejar Telegram en una etapa posterior. */
IF COL_LENGTH('cobranzas.abonos_cobranza', 'origen_cobro') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD origen_cobro NVARCHAR(20) NOT NULL
        CONSTRAINT DF_abonos_cobranza_origen_cobro DEFAULT N'DOMICILIO';
IF COL_LENGTH('cobranzas.abonos_cobranza', 'id_cajero_turno') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD id_cajero_turno INT NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_abonos_cobranza_cajero_turnos')
    ALTER TABLE cobranzas.abonos_cobranza ADD CONSTRAINT FK_abonos_cobranza_cajero_turnos
        FOREIGN KEY (id_cajero_turno) REFERENCES pv.cajero_turnos(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_abonos_cobranza_id_cajero_turno' AND object_id = OBJECT_ID('cobranzas.abonos_cobranza'))
    CREATE INDEX IX_abonos_cobranza_id_cajero_turno ON cobranzas.abonos_cobranza(id_cajero_turno)
        WHERE id_cajero_turno IS NOT NULL;
GO

/* Agrega el permiso hijo para mostrar la pantalla de apertura de caja. */
USE security;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.detailedpermissions WHERE master_id = (SELECT TOP 1 id FROM dbo.masterpermissions WHERE identifier = 'cobranzas') AND identifier = 'aperturacaja')
BEGIN
    INSERT INTO dbo.detailedpermissions (master_id, permission_name, identifier, comment, active, [order])
    SELECT id, N'Apertura Caja', 'aperturacaja', N'Apertura de turno de caja para Cobranza', 1, 15
    FROM dbo.masterpermissions WHERE identifier = 'cobranzas';
END;
GO

/* Asigna Apertura Caja a los usuarios activos de la empresa 60 que ya tienen Cobranza. */
DECLARE @CompanyId INT = 60;
DECLARE @CobranzasId INT = (SELECT TOP 1 id FROM dbo.masterpermissions WHERE identifier = 'cobranzas');
DECLARE @AperturaCajaId INT = (SELECT TOP 1 id FROM dbo.detailedpermissions WHERE master_id = @CobranzasId AND identifier = 'aperturacaja' AND active = 1);
INSERT INTO dbo.userxsecuritypermissions_company (user_id, company_id, permission_id, active)
SELECT usuario.id, @CompanyId, @AperturaCajaId, 1
FROM dbo.Users usuario
WHERE usuario.id_company = @CompanyId AND usuario.Active = 1
  AND @AperturaCajaId IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions_company asignado
      WHERE asignado.user_id = usuario.id AND asignado.company_id = @CompanyId
        AND asignado.permission_id = @CobranzasId AND asignado.active = 1
  )
  AND NOT EXISTS (
      SELECT 1 FROM dbo.userxsecuritypermissions_company existente
      WHERE existente.user_id = usuario.id AND existente.company_id = @CompanyId
        AND existente.permission_id = @AperturaCajaId
  );
GO

USE administration;
GO
IF NOT EXISTS (SELECT 1 FROM dbo.product_updates WHERE version = N'5.00.492' AND module = N'Cobranza / Caja y abonos' AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
    INSERT INTO dbo.product_updates (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,createdAtUtc,updatedAtUtc,isActive)
    VALUES (NULL,NULL,N'5.00.492',N'Cobranza / Caja y abonos',N'IMPROVEMENT',N'Apertura de caja y ticket de abonos',N'Cobranza permite abrir turno con tienda, caja y fondo inicial; distingue los abonos recibidos en negocio y domicilio y genera un ticket imprimible.',N'Facilita controlar el efectivo por turno y entregar un comprobante de cada pago.',N'Abre tu caja de cobranza y entrega un ticket al registrar cada abono.',SYSUTCDATETIME(),N'America/Indiana/Indianapolis',N'PENDING',N'LOCAL',N'DRAFT',NULL,NULL,SYSUTCDATETIME(),SYSUTCDATETIME(),1);
END;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_cajas_menu.sql-- ============================================================================
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
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_corte_caja_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.491' AND module = N'Cobranza / Corte Caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.491', N'Cobranza / Corte Caja', N'IMPROVEMENT',
        N'Tipos de pago y corte de caja de cobranza',
        N'Los abonos registran su tipo de pago y responsable. Corte Caja consulta movimientos y totales por período, y permite guardar cortes globales o por cobrador.',
        N'Facilita revisar los cobros y conservar el detalle de cada corte.',
        N'Consulta los cobros por tipo de pago y prepara cortes de caja globales o por cobrador.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.491' AND module = N'Cobranza / Corte Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_cortes_pago.sql-- ============================================================================
USE administration;
GO

/* Medios de pago de Cobranza por empresa. El catálogo admite más opciones. */
INSERT INTO dbo.catalog (id_company, description, valueaddition, valueaddition2, election, type, parent_id, subparent_id, iNivel, active)
SELECT empresas.id_company, medios.description, 'NA', 'NA', 1, 'COBRO_PAGO', NULL, NULL, NULL, 1
FROM (
    SELECT DISTINCT id_company FROM dbo.catalog WHERE id_company IS NOT NULL
    UNION
    SELECT DISTINCT id_root FROM dbo.customers WHERE id_root IS NOT NULL
) empresas
CROSS JOIN (VALUES (N'EFECTIVO'), (N'TRANSFERENCIA'), (N'TARJETA')) medios(description)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.catalog existente
    WHERE existente.id_company = empresas.id_company AND existente.type = 'COBRO_PAGO'
      AND existente.description = medios.description AND existente.active = 1
);
GO

IF COL_LENGTH('cobranzas.abonos_cobranza', 'id_tipo_pago') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD id_tipo_pago INT NULL;
IF COL_LENGTH('cobranzas.abonos_cobranza', 'id_usuario_cobrador') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD id_usuario_cobrador INT NULL;
GO

IF OBJECT_ID('cobranzas.cortes_cobranza', 'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cortes_cobranza (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_root INT NOT NULL,
        id_usuario_cobrador INT NULL,
        fecha_desde DATE NOT NULL,
        fecha_hasta DATE NOT NULL,
        total DECIMAL(18,2) NOT NULL,
        observaciones NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL DEFAULT 1,
        CONSTRAINT CK_cortes_cobranza_fechas CHECK (fecha_hasta >= fecha_desde)
    );
    CREATE INDEX IX_cortes_cobranza_root_fecha ON cobranzas.cortes_cobranza(id_root, fecha_desde, fecha_hasta, id_usuario_cobrador);
END;
GO

IF OBJECT_ID('cobranzas.cortes_cobranza_abonos', 'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cortes_cobranza_abonos (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_corte INT NOT NULL,
        id_abono INT NOT NULL,
        id_tipo_pago INT NULL,
        id_usuario_cobrador INT NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_cortes_cobranza_abonos_corte FOREIGN KEY (id_corte) REFERENCES cobranzas.cortes_cobranza(id),
        CONSTRAINT FK_cortes_cobranza_abonos_abono FOREIGN KEY (id_abono) REFERENCES cobranzas.abonos_cobranza(id),
        CONSTRAINT UQ_cortes_cobranza_abono UNIQUE (id_corte, id_abono)
    );
END;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_dashboard_product_update.sql-- ============================================================================
USE administration;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (
  SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
  WHERE version = N'5.00.490' AND module = N'Cobranza / Dashboard'
    AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
  INSERT INTO dbo.product_updates
  (idRoot, idCompany, version, module, changeType, title, description,
   userBenefit, promoText, occurredAtUtc, displayTimeZone,
   validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
   createdBy, createdAtUtc, updatedAtUtc, isActive)
  VALUES
  (NULL, NULL, N'5.00.490', N'Cobranza / Dashboard', N'IMPROVEMENT',
   N'Dashboard de cartera y cobranza',
   N'Consulta cartera otorgada, recuperada, pendiente y vencida; compara cobros programados y recibidos por mes y revisa vencimientos y próximos pagos por cliente.',
   N'Permite priorizar la cobranza y seguir el avance de los préstamos desde una sola pantalla.',
   N'Conoce tu cartera, detecta vencidos y anticipa los próximos cobros.',
   SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
   N'PASSED', N'LOCAL', N'DRAFT', NULL,
   NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1);
END;
COMMIT TRANSACTION;
SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.490' AND module = N'Cobranza / Dashboard'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_cobranza_grid_pdf_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.488' AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.488', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Calendario de cuotas y reporte PDF de pagos',
        N'Consulta las cuotas de cada préstamo en un grid de detalle, ajusta sus fechas y genera desde el maestro un reporte PDF con los pagos y el logo de la empresa.',
        N'Permite adaptar el calendario de cobro y entregar un reporte claro al cliente.',
        N'Ajusta las fechas de pago y genera el reporte PDF con la imagen de tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.488' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Empresas
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_company_type_catalog.sql-- ============================================================================
USE smp;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_root_tipo_empresa'
      AND parent_object_id = OBJECT_ID(N'dbo.root')
)
BEGIN
    ALTER TABLE dbo.root DROP CONSTRAINT CK_root_tipo_empresa;
END;

DECLARE @CompanyTypes TABLE (Description NVARCHAR(100), ValueAddition VARCHAR(25));
INSERT INTO @CompanyTypes (Description, ValueAddition)
VALUES
    (N'Construcción', 'CONSTRUCCION'),
    (N'Clínica', 'CLINICA'),
    (N'Escuelas', 'ESCUELAS'),
    (N'Restaurantes', 'RESTAURANTES'),
    (N'Comercializadora', 'COMERCIALIZADORA');

INSERT INTO dbo.catalog (id_company, description, valueaddition, type, vigente, active)
SELECT 0, types.Description, types.ValueAddition, 'TIPO-EMPRESA', 1, 1
FROM @CompanyTypes AS types
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.catalog AS existing
    WHERE existing.id_company = 0
      AND existing.type = 'TIPO-EMPRESA'
      AND existing.valueaddition = types.ValueAddition
      AND existing.active = 1
);

COMMIT TRANSACTION;

SELECT id, id_company, type, description, valueaddition, active, vigente
FROM dbo.catalog
WHERE id_company = 0 AND type = 'TIPO-EMPRESA' AND active = 1
ORDER BY description;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_create_cobranza_loan_schedule.sql-- ============================================================================
use administration;
/* Plan de préstamos y cobros por cliente en Administration.
   Cada préstamo genera el número configurable de cuotas mensuales; cada cuota puede recibir varios abonos. */
IF OBJECT_ID(N'cobranzas.prestamos_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.prestamos_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_prestamos_cobranza PRIMARY KEY,
        id_customer INT NOT NULL,
        monto_total DECIMAL(18,2) NOT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_primer_pago DATE NOT NULL,
        numero_cuotas INT NOT NULL CONSTRAINT DF_prestamos_cobranza_numero_cuotas DEFAULT (10),
        comentario NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_prestamos_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_prestamos_cobranza_active DEFAULT (1),
        CONSTRAINT CK_prestamos_cobranza_monto CHECK (monto_total > 0),
        CONSTRAINT CK_prestamos_cobranza_cuotas CHECK (numero_cuotas >= 1),
        CONSTRAINT FK_prestamos_cobranza_customers FOREIGN KEY (id_customer) REFERENCES dbo.customers(id)
    );
    CREATE INDEX IX_prestamos_cobranza_customer ON cobranzas.prestamos_cobranza(id_customer, active, inicio DESC);
END;
GO

IF OBJECT_ID(N'cobranzas.cuotas_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cuotas_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cuotas_cobranza PRIMARY KEY,
        id_prestamo INT NOT NULL,
        numero_cuota INT NOT NULL,
        fecha_programada DATE NOT NULL,
        monto_programado DECIMAL(18,2) NOT NULL,
        comentario NVARCHAR(500) NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_cuotas_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_cuotas_cobranza_active DEFAULT (1),
        CONSTRAINT CK_cuotas_cobranza_numero CHECK (numero_cuota >= 1),
        CONSTRAINT CK_cuotas_cobranza_monto CHECK (monto_programado > 0),
        CONSTRAINT UQ_cuotas_cobranza_numero UNIQUE (id_prestamo, numero_cuota),
        CONSTRAINT FK_cuotas_cobranza_prestamos FOREIGN KEY (id_prestamo) REFERENCES cobranzas.prestamos_cobranza(id)
    );
    CREATE INDEX IX_cuotas_cobranza_prestamo_fecha ON cobranzas.cuotas_cobranza(id_prestamo, fecha_programada, numero_cuota);
END;
GO

/* Actualiza las restricciones en instalaciones creadas con el calendario fijo de 10 pagos. */
IF OBJECT_ID(N'cobranzas.prestamos_cobranza', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'cobranzas.prestamos_cobranza') AND name = N'CK_prestamos_cobranza_cuotas')
        ALTER TABLE cobranzas.prestamos_cobranza DROP CONSTRAINT CK_prestamos_cobranza_cuotas;
    ALTER TABLE cobranzas.prestamos_cobranza ADD CONSTRAINT CK_prestamos_cobranza_cuotas CHECK (numero_cuotas >= 1);
END;
GO

IF OBJECT_ID(N'cobranzas.cuotas_cobranza', N'U') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID(N'cobranzas.cuotas_cobranza') AND name = N'CK_cuotas_cobranza_numero')
        ALTER TABLE cobranzas.cuotas_cobranza DROP CONSTRAINT CK_cuotas_cobranza_numero;
    ALTER TABLE cobranzas.cuotas_cobranza ADD CONSTRAINT CK_cuotas_cobranza_numero CHECK (numero_cuota >= 1);
END;
GO

IF OBJECT_ID(N'cobranzas.abonos_cobranza', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.abonos_cobranza
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_abonos_cobranza PRIMARY KEY,
        id_cuota INT NOT NULL,
        fecha_pago DATE NOT NULL,
        comentario NVARCHAR(500) NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_abonos_cobranza_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_abonos_cobranza_active DEFAULT (1),
        CONSTRAINT CK_abonos_cobranza_monto CHECK (monto > 0),
        CONSTRAINT FK_abonos_cobranza_cuotas FOREIGN KEY (id_cuota) REFERENCES cobranzas.cuotas_cobranza(id)
    );
    CREATE INDEX IX_abonos_cobranza_cuota_fecha ON cobranzas.abonos_cobranza(id_cuota, fecha_pago, id);
END;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_create_cobranza_payments.sql-- ============================================================================
use administration;
/* Historial de abonos por cliente del módulo Cobranza (base Administration). */
IF OBJECT_ID(N'cobranzas.pagos_cobranzas', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.pagos_cobranzas
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_pagos_cobranzas PRIMARY KEY,
        id_customer INT NOT NULL,
        fecha_pago DATE NOT NULL,
        comentario NVARCHAR(500) NULL,
        monto DECIMAL(18,2) NOT NULL,
        inicio DATETIME2(0) NOT NULL CONSTRAINT DF_pagos_cobranzas_inicio DEFAULT SYSUTCDATETIME(),
        active BIT NOT NULL CONSTRAINT DF_pagos_cobranzas_active DEFAULT (1),
        CONSTRAINT CK_pagos_cobranzas_monto CHECK (monto > 0),
        CONSTRAINT FK_pagos_cobranzas_customers FOREIGN KEY (id_customer) REFERENCES dbo.customers(id)
    );
    CREATE INDEX IX_pagos_cobranzas_customer_fecha
        ON cobranzas.pagos_cobranzas (id_customer, fecha_pago DESC, id DESC)
        INCLUDE (monto, active);
END;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Empresas
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_add_company_type_from_selector_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.473' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.473', N'SMP / Empresas', 'FEATURE',
        N'Agrega un tipo de empresa desde el selector',
        N'El selector Tipo de empresa incluye Agregar Nuevo. Al elegirlo, solicita un nombre, lo guarda en el catálogo compartido de SMP y lo selecciona en la empresa. Si el tipo ya existe, permite reutilizarlo.',
        N'Permite incorporar tipos para probarlos sin salir del formulario ni modificar código.',
        N'Agrega nuevos tipos de empresa desde el mismo selector.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.473' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.473' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_collections_customers_route_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.476' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.476', N'Cobranza / Clientes', 'FEATURE',
        N'Acceso de clientes para el módulo de Cobranza',
        N'Se agregó el acceso Cobranza al sidebar y la ruta /cobranza/clientes. Reutiliza el componente existente de Clientes y verifica el permiso maestro cobranzas junto con el detalle cliente.',
        N'Permite administrar clientes de cobranza con permisos específicos del módulo.',
        N'Administra los clientes de cobranza desde su propio acceso y permiso.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.476' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.476' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Empresas
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_company_type_catalog_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.472' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.472', N'SMP / Empresas', 'FEATURE',
        N'Tipos de empresa administrados desde el catálogo',
        N'El selector Tipo de empresa de /smp/root carga sus opciones del catálogo compartido de SMP. Incluye Construcción, Clínica, Escuelas, Restaurantes y Comercializadora. Las opciones futuras se administran como datos del catálogo y ya no están fijas en la pantalla.',
        N'Permite agregar tipos de empresa al catálogo sin cambiar el código del formulario.',
        N'Administra los tipos de empresa desde el catálogo, ahora con Comercializadora.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.472' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.472' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_inventory_entry_updates.sql-- ============================================================================
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
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_material_delete_protection_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.470' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.470', N'Almacenes / Materiales', 'FIX',
        N'Aviso al eliminar materiales relacionados',
        N'Antes de eliminar un material se solicita confirmación. Si el servicio rechaza el borrado, se muestra el motivo recibido o se indica que puede tener entradas, requisiciones, órdenes de compra o salidas asociadas. La validación efectiva depende del servicio Warehouse.',
        N'Ayuda a conservar materiales que forman parte de documentos y movimientos, e informa por qué no se pudo eliminar.',
        N'Protege tus movimientos: conoce por qué no se puede eliminar un material relacionado.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION',
    validationStatus = 'PENDING'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.470' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.470' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_newest_permissions_first_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.475' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.475', N'Seguridad / Permisos', 'FIX',
        N'Los permisos más nuevos aparecen primero',
        N'Los grids de permisos principales, detalles y subdetalles se ordenan por ID descendente al abrirse. Las filas recién agregadas sin ID permanecen arriba mientras se capturan.',
        N'Facilita encontrar los permisos agregados más recientemente en cada nivel.',
        N'Encuentra primero los permisos más nuevos en cada nivel del catálogo.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.475' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.475' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_project_material_delete_protection_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.471' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.471', N'Proyectos / Materiales', 'FIX',
        N'Protección al eliminar materiales con movimientos',
        N'Antes de eliminar un material se consultan las partidas de requisiciones, OC, entradas y salidas del proyecto o sucursal actual. Si hay referencias, el borrado se detiene y se indican los tipos encontrados. Si falla la consulta, también se detiene el borrado. La revisión cubre el contexto actual.',
        N'Evita eliminar materiales usados en documentos del proyecto y conserva el registro si no se pudo verificar su historial.',
        N'Protege tus materiales en Proyectos: consulta sus movimientos antes de eliminarlos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.471' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.471' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 13/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261113_publish_reactive_sidebar_permissions_update.sql-- ============================================================================
USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.474' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.474', N'Seguridad / Sidebar y permisos', 'FEATURE',
        N'Permisos y sidebar se actualizan automáticamente',
        N'La sesión consulta los permisos de la empresa cada 10 segundos y al regresar a la pestaña. Los cambios asignados desde otro equipo actualizan automáticamente las opciones del sidebar sin cerrar sesión ni recargar manualmente.',
        N'Refleja los permisos nuevos o revocados entre equipos con pocos segundos de espera.',
        N'Tus permisos y el sidebar se actualizan automáticamente en todos tus equipos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

UPDATE dbo.product_updates
SET releaseStatus = 'PRODUCTION'
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.474' AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.474' AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_busqueda_filtros_materiales_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.525',
    module = N'Almacenes / Materiales',
    changeType = N'IMPROVEMENT',
    title = N'Búsqueda y filtros para materiales',
    description = N'El listado de materiales permite buscar por texto parcial en códigos, descripciones, familias y marcas. También puede filtrarse para mostrar materiales con requisiciones, órdenes de compra, entradas, salidas o cotizaciones, y materiales con existencia total positiva en la empresa.',
    userBenefit = N'Permite encontrar materiales con menos pasos y enfocar la consulta en artículos con actividad o existencia.',
    promoText = N'Encuentra materiales con “DES” y filtra en segundos los que tienen movimientos o existencia.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_carga_descripcion_editor_cotizacion_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.536',
    module = N'Ventas / Cotizaciones',
    changeType = N'FIX',
    title = N'Carga de descripción al editar partidas',
    description = N'Al abrir el editor de una partida, se carga de forma explícita la descripción actual, incluyendo el formato en negrita guardado.',
    userBenefit = N'Evita que el editor aparezca vacío y permite continuar modificando el texto de la cotización.',
    promoText = N'Abre la descripción de una partida y continúa editándola con su texto y formato actuales.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_clientes_catalogo_postal_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.526',
    module = N'Cobranza / Clientes',
    changeType = N'FIX',
    title = N'Catálogo postal disponible al editar clientes',
    description = N'Al seleccionar o editar un cliente existente se carga el catálogo de colonias, ciudad y estado correspondiente a su código postal, igual que al capturar un cliente nuevo.',
    userBenefit = N'Permite corregir o completar la dirección de clientes existentes sin volver a escribir el código postal.',
    promoText = N'Edita un cliente y selecciona su colonia con la misma ayuda automática del código postal.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_clientes_filtros_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.513' AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.513', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Filtros de saldos pendientes y pagos vencidos',
        N'El listado de clientes permite mostrar todos, solo quienes tienen saldo pendiente o solo quienes tienen cuotas vencidas con importe sin cubrir. Los filtros se actualizan al registrar o quitar abonos y al cambiar fechas de pago.',
        N'Ayuda a localizar la cartera pendiente y los atrasos sin revisar cada cliente.',
        N'Encuentra rapidamente clientes con saldo pendiente y pagos vencidos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.513' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_clientes_totales_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.512' AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.512', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Totales de prestamos, pagos y pendientes por cliente',
        N'El listado presenta tres columnas fijas con los montos de prestamos, pagos y saldos pendientes por cliente, cada una con un color distinto. Oculta Activo y Total credito; actualiza los importes al cambiar prestamos o abonos.',
        N'Permite conocer el estado de cobranza de cada cliente sin abrir su detalle.',
        N'Revisa de un vistazo prestamos, pagos y pendientes de cada cliente.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.512' AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_cobradores_reporte_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.511' AND module = N'Cobranza / Cobradores'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.511', N'Cobranza / Cobradores', N'IMPROVEMENT',
        N'Reporte de cobros por vendedor y fechas',
        N'Genera un PDF de cobros agrupados por vendedor para un periodo seleccionado, con logo, detalle de pagos, subtotales y total general. Se puede imprimir, descargar y compartir por Telegram o correo.',
        N'Permite revisar y entregar los cobros de cada vendedor para fechas especificas.',
        N'Consulta y comparte los cobros por vendedor en un reporte con el logo de tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.511' AND module = N'Cobranza / Cobradores'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_fondo_inicial_reporte_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.524',
    module = N'Cobranza / Corte de Caja',
    changeType = N'IMPROVEMENT',
    title = N'Fondo inicial incluido en el reporte de Cobranza',
    description = N'El reporte y PDF del corte incluyen el fondo inicial de los turnos de cobranza del período, con desglose por turno y total. El fondo se muestra separado de los abonos recibidos.',
    userBenefit = N'Permite cuadrar la caja considerando el efectivo con que se abrió cada turno.',
    promoText = N'Consulta en el corte de Cobranza cuánto efectivo se dejó al abrir la caja y cuánto se recibió en abonos.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_plazo_variable.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'cobranzas.prestamos_cobranza')
      AND name = N'CK_prestamos_cobranza_cuotas'
)
    ALTER TABLE cobranzas.prestamos_cobranza
        DROP CONSTRAINT CK_prestamos_cobranza_cuotas;

ALTER TABLE cobranzas.prestamos_cobranza
    ADD CONSTRAINT CK_prestamos_cobranza_cuotas
    CHECK (numero_cuotas >= 1);

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'cobranzas.cuotas_cobranza')
      AND name = N'CK_cuotas_cobranza_numero'
)
    ALTER TABLE cobranzas.cuotas_cobranza
        DROP CONSTRAINT CK_cuotas_cobranza_numero;

ALTER TABLE cobranzas.cuotas_cobranza
    ADD CONSTRAINT CK_cuotas_cobranza_numero
    CHECK (numero_cuota >= 1);

COMMIT TRANSACTION;
GO

SELECT name, is_disabled, is_not_trusted
FROM sys.check_constraints
WHERE name IN (N'CK_prestamos_cobranza_cuotas', N'CK_cuotas_cobranza_numero');
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_saldo_precargado_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear duplicados.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.523',
    module = N'Cobranza / Clientes y tickets',
    changeType = N'IMPROVEMENT',
    title = N'Saldo pendiente listo al registrar abonos',
    description = N'El detalle abierto del cliente sincroniza abonos cada 5 segundos. Al pulsar Abonos, el campo Monto recibido se llena con el saldo pendiente de esa cuota y se puede editar. El ticket usa el visor PDF estándar con opciones para compartir y descargar.',
    userBenefit = N'Refleja los cobros recientes y ahorra capturar manualmente el monto pendiente.',
    promoText = N'Consulta los abonos actualizados y cobra el saldo de la cuota con el importe ya listo en pantalla.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_sincronizacion_automatica_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.521',
    module = N'Cobranza / Clientes',
    changeType = N'IMPROVEMENT',
    title = N'Sincronización automática de abonos en Cobranza',
    description = N'El detalle del cliente abierto revisa los préstamos y abonos cada 5 segundos; si encuentra cambios, actualiza los saldos y pagos en la web. Al abrir el formulario de abono, precarga el saldo pendiente de la cuota seleccionada y permite modificarlo. La sincronización se pausa mientras se edita el detalle.',
    userBenefit = N'Refleja los abonos hechos desde Telegram sin cerrar al cliente y agiliza la captura del monto a cobrar.',
    promoText = N'Consulta un cliente y ve sus abonos reflejados automáticamente; al cobrar, el monto pendiente ya aparece listo para registrar.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_telegram_busqueda_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.514' AND module = N'Cobranza / Telegram'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.514', N'Cobranza / Telegram', N'IMPROVEMENT',
        N'Busqueda de clientes de Cobranza en Telegram',
        N'El bot muestra Cobranza segun los permisos y permite buscar clientes con prestamo activo por numero, telefono o nombre dentro de la empresa seleccionada. Si el usuario tiene una sola empresa, entra directamente.',
        N'El cobrador identifica al cliente correcto desde Telegram sin recorrer listados de otras empresas.',
        N'Encuentra a tus clientes de Cobranza desde Telegram con su numero, telefono o nombre.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.514' AND module = N'Cobranza / Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_telegram_permission_fix.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.516',
    changeType = N'IMPROVEMENT',
    title = N'Corrección del menú de Cobranza en Telegram',
    description = N'Se corrigió la consulta de permisos de empresa que impedía cargar los módulos del usuario. Telegram respeta la configuración por empresa, sus permisos heredados y los permisos antiguos por sucursal.',
    userBenefit = N'El cobrador puede ver Cobranza en Telegram cuando el módulo está habilitado para su empresa y usuario.',
    promoText = N'Consulta Cobranza desde Telegram con los permisos de tu empresa.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates WHERE id = 291 AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cobranza_ticket_visor_estandar_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.522',
    module = N'Cobranza / Tickets',
    changeType = N'IMPROVEMENT',
    title = N'Ticket de abono en el visor PDF estándar',
    description = N'El ticket que se genera al registrar un abono en Clientes abre en el visor PDF estándar, con sus opciones para compartir, enviar o descargar, sin abrir otra pestaña.',
    userBenefit = N'Permite revisar y compartir el comprobante desde la misma pantalla de Cobranza.',
    promoText = N'Comparte o descarga el ticket de cada abono desde el visor PDF de Cobranza.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cotizacion_encabezado_editable_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.543',
    module = N'Ventas / Cotizaciones',
    changeType = N'FEATURE',
    title = N'Encabezado editable para cotizaciones',
    description = N'Desde el detalle se puede editar el destinatario, empresa, puesto, lugar, fecha del documento, número y asunto. El PDF se actualiza con esos valores y la fecha original de creación se conserva.',
    userBenefit = N'Permite adaptar el encabezado de cada propuesta a quien la recibirá, sin cambiar el cliente vinculado ni la fecha original de creación.',
    promoText = N'Personaliza el encabezado de cada cotización y genera un PDF con los datos correctos para tu destinatario.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cotizacion_header_editor_ui_fix_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.544',
    module = N'Ventas / Cotizaciones',
    changeType = N'FIX',
    title = N'Editor accesible para el encabezado de cotizaciones',
    description = N'El formulario para editar destinatario y encabezado aparece dentro del detalle, encima de las partidas o del PDF, sin una ventana flotante que pueda quedar bloqueada por la cuadrícula.',
    userBenefit = N'Mantiene visibles los campos de edición y evita que los clics activen acciones de la cotización de fondo.',
    promoText = N'Edita el encabezado desde el mismo detalle de la cotización, sin ventanas que se queden bloqueadas.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cotizaciones_busqueda_clave_descripcion_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.528',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Selector amplio para buscar partidas',
    description = N'Al agregar una partida, el selector muestra la clave junto con la descripción, permite escribir para buscar por cualquiera de los dos datos y ahora tiene un ancho amplio para leer y capturar cómodamente.',
    userBenefit = N'Reduce el tiempo para localizar la partida correcta dentro del catálogo de cotizaciones y evita trabajar en un campo estrecho.',
    promoText = N'Encuentra tus productos y servicios por clave o descripción en un selector amplio.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cotizaciones_en_movimientos_materiales_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.533',
    module = N'Almacenes / Materiales; Proyectos / Precios Unitarios',
    changeType = N'FIX',
    title = N'Cotizaciones en movimientos y desglose inicial APU',
    description = N'El resumen de movimientos busca las cotizaciones dentro de cada requisición y suma sus partidas al material relacionado. Al abrir el catálogo APU se selecciona la primera fila y se carga su desglose, incluso si el grid termina de iniciar después de los datos.',
    userBenefit = N'Identifica materiales cotizados y permite ver el primer desglose sin tener que abrirlo manualmente.',
    promoText = N'Consulta los materiales incluidos en cotizaciones y abre Precios Unitarios directamente con el primer desglose visible.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_cotizaciones_guardado_partidas_atomico_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.542',
    module = N'Ventas / Productos y Cotizaciones',
    changeType = N'FIX',
    title = N'Guardado seguro de productos y cotizaciones',
    description = N'Al editar un producto se envían solo los campos modificados, evitando que datos antiguos del registro provoquen el rechazo de una imagen nueva; los errores de validación del servidor se muestran con su campo. El guardado de partidas conserva lo que no esté cargado y elimina solo las partidas confirmadas.',
    userBenefit = N'Facilita guardar imágenes de productos y protege las partidas existentes de las cotizaciones.',
    promoText = N'Actualiza imágenes de productos y guarda cotizaciones con mayor seguridad, sin perder partidas que no aparecen en pantalla.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_editor_descripcion_partidas_cotizacion_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.534',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Editor amplio para descripciones de cotización',
    description = N'Al dar doble clic en la descripción de una partida se abre un editor amplio para modificar el texto guardado en esa cotización.',
    userBenefit = N'Facilita revisar y personalizar descripciones largas sin cambiar el producto del catálogo.',
    promoText = N'Personaliza la descripción de cada partida de cotización desde un editor amplio.',
    validationStatus = N'PENDING',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_formato_texto_cotizacion_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.537',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Formato de texto en descripciones de cotización',
    description = N'El editor de partidas permite cambiar el tamaño de letra y aplicar negrita, cursiva y subrayado. Los estilos se conservan en la cotización y en el PDF.',
    userBenefit = N'Ayuda a ordenar y destacar información dentro de las descripciones de cada partida.',
    promoText = N'Da formato a las descripciones de tus cotizaciones: ajusta el tamaño y resalta texto.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_mas_espacio_busqueda_partidas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.538',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Más espacio al buscar partidas de cotización',
    description = N'Al agregar productos o servicios, el grid de partidas tiene más altura y el selector ofrece un área de búsqueda más amplia para escribir y revisar resultados.',
    userBenefit = N'Facilita encontrar la partida correcta al capturar una cotización.',
    promoText = N'Busca productos y servicios con más espacio al agregar partidas a tus cotizaciones.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Ventas / Cotizaciones
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_negritas_descripcion_cotizacion_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.535',
    module = N'Ventas / Cotizaciones',
    changeType = N'IMPROVEMENT',
    title = N'Formato de negrita en partidas de cotización',
    description = N'El editor de descripción de partidas incluye formato de negrita. El formato se conserva en la partida y se muestra también en el PDF.',
    userBenefit = N'Permite destacar datos importantes sin cambiar el texto base del producto del catálogo.',
    promoText = N'Resalta con negritas la información importante de cada partida y consérvala en el PDF.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_precios_unitarios_pestana_inicial_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.530',
    module = N'Proyectos / Precios Unitarios',
    changeType = N'IMPROVEMENT',
    title = N'Catálogo abre con el desglose del primer precio',
    description = N'Al abrir Precios Unitarios desde la ruta principal, se muestra automáticamente la primera pestaña del catálogo, se selecciona el primer precio unitario y se carga su desglose de componentes.',
    userBenefit = N'Permite entrar al catálogo y consultar de inmediato cómo se integra el primer precio sin buscarlo y abrirlo manualmente.',
    promoText = N'Abre el catálogo y consulta desde el inicio el desglose de tu primer precio unitario.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_productos_edicion_doble_clic_familia_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.531',
    module = N'Ventas / Productos',
    changeType = N'FIX',
    title = N'Edición de productos y subfamilias',
    description = N'Se restauró la edición de celdas con doble clic y, al cambiar la familia, se limpia la subfamilia anterior para elegir una compatible.',
    userBenefit = N'Permite editar desde el grid y evita guardar una subfamilia que pertenece a otra familia.',
    promoText = N'Edita productos con doble clic y asigna presentaciones de la familia correcta.',
    validationStatus = N'PENDING',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_productos_subfamilia_imagen_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.540',
    module = N'Ventas / Productos',
    changeType = N'FIX',
    title = N'Edición de productos y selector de subfamilia',
    description = N'El selector de subfamilia permite elegir opciones con mouse y teclado, y la edición del producto envía únicamente los campos del material. Si el servidor rechaza el guardado, se muestra el detalle de validación disponible. La carga de imagen admite JPG, PNG y WEBP.',
    userBenefit = N'Permite clasificar y editar productos con más facilidad, e identifica el motivo del rechazo al guardar.',
    promoText = N'Edita productos, elige su subfamilia con mouse o teclado y consulta el motivo si un guardado requiere corrección.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_telegram_cobranza_abonos_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente de Cobranza / Telegram sin crear duplicados.
-- Mantener LOCAL hasta contar con evidencia de despliegue del código.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.517',
    module = N'Cobranza / Telegram y tickets',
    changeType = N'IMPROVEMENT',
    title = N'Registro de abonos y ticket PDF en Telegram',
    description = N'El cobrador puede registrar abonos desde Telegram y recibir el comprobante PDF guardado en Firebase con el logo de la empresa. Los comprobantes web y de Telegram muestran cuánto queda pendiente después del abono.',
    userBenefit = N'Permite cobrar en campo y entregar un ticket con el saldo actualizado, mientras la impresión física no está disponible.',
    promoText = N'Registra abonos desde Telegram y entrega comprobantes con el saldo pendiente actualizado.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_telegram_cobranza_prestamo_unico_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.520',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Selección automática de préstamo único en Telegram',
    description = N'Si el cliente tiene un solo préstamo con saldo pendiente, Telegram abre directamente sus próximas cuotas; si tiene varios, muestra la lista para elegir.',
    userBenefit = N'Reduce pasos al registrar el abono sin perder la elección cuando existe más de un préstamo.',
    promoText = N'Registra un abono más rápido: Telegram abre automáticamente el único préstamo pendiente.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_telegram_cobranza_proximas_cuotas_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.519',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Próximas cuotas pendientes en Telegram',
    description = N'Al registrar un abono, la lista muestra solo las 3 cuotas pendientes con fecha más cercana.',
    userBenefit = N'Facilita elegir rápidamente la cuota correcta sin recorrer toda la tabla de pagos.',
    promoText = N'Consulta y selecciona las próximas cuotas pendientes desde Telegram.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 14/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261114_telegram_cobranza_seleccion_unica_update.sql-- ============================================================================
USE administration;
GO

-- Actualiza el anuncio vigente sin crear un registro duplicado.
SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.518',
    module = N'Cobranza / Telegram',
    changeType = N'IMPROVEMENT',
    title = N'Selección automática de cliente único en Telegram',
    description = N'Cuando la búsqueda encuentra un solo cliente, Telegram lo abre automáticamente; si encuentra varios, conserva la selección por lista.',
    userBenefit = N'Reduce pasos al cobrador y mantiene la confirmación cuando hay más de un resultado posible.',
    promoText = N'Busca un cliente en Telegram y entra directo cuando solo hay una coincidencia.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 15/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261115_deduplicate_project_permissions.sql-- ============================================================================
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
-- ============================================================================
-- Fecha: 15/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261115_permissions_grid_height_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.547' AND module = N'Seguridad / Permisos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.547', N'Seguridad / Permisos', N'IMPROVEMENT',
        N'Grids ampliados del catálogo de permisos',
        N'El catálogo principal y los grids de Detalles y SubDetalles ahora tienen más altura para consultar sus registros con menos desplazamiento.',
        N'Facilita comparar permisos y sus niveles relacionados en una misma vista.',
        N'Consulta más permisos y sus detalles en pantalla desde el catálogo de Seguridad.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PASSED', N'LOCAL', N'DRAFT', NULL,
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE version = N'5.00.547' AND module = N'Seguridad / Permisos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 15/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261115_projects_permissions_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET version = N'5.00.545',
    module = N'Seguridad / Proyectos',
    changeType = N'FIX',
    title = N'Permisos de Proyectos consolidados',
    description = N'Se consolidaron los permisos duplicados de Contratos y Conceptos sin perder asignaciones existentes. Las rutas del módulo ahora validan el permiso detallado correspondiente; el menú de Órdenes oculta Búsquedas OT si falta su permiso. El enlace de Precios Unitarios se muestra con el permiso del catálogo.',
    userBenefit = N'Evita entradas repetidas en la asignación de permisos y bloquea el acceso por URL a secciones que el usuario no tiene habilitadas.',
    promoText = N'Asigna accesos de Proyectos sin duplicados y protege cada sección según su permiso.',
    validationStatus = N'PASSED',
    releaseStatus = N'LOCAL',
    updatedAtUtc = SYSUTCDATETIME()
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE id = 291 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 19/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261119_cobranza_prestamo_pagares_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.556', N'Cobranza / Préstamos', N'IMPROVEMENT',
        N'Interés mensual y desglose del pagaré',
        N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. La lista separa cada préstamo; al abrir su detalle se consultan sus pagos y se genera el PDF de ese préstamo. La nota conserva la composición de referencia: folio ligado al préstamo, franja azul marino para el cliente, panel gris de totales, calendario de pagos y sección de pagaré enmarcada con espacio de firma para el deudor, sin aval. La vista previa permite imprimir y compartir; para 10 pagos, el contenido cabe en una página.',
        N'Identifica cada préstamo del cliente y entrega la nota correspondiente con el desglose de capital e interés.',
        N'Abre el préstamo que necesitas y genera su pagaré con cada mensualidad detallada.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

/* Keep the announcement aligned with refinements to the same release; do not create duplicates. */
UPDATE dbo.product_updates
SET description = N'El alta permite capturar el interés fijo mensual y consultar el desglose de las cuotas. La lista separa cada préstamo; al abrir su detalle se consultan sus pagos y se genera el PDF de ese préstamo. La nota conserva la composición de referencia: folio ligado al préstamo, franja azul marino para el cliente, panel gris de totales, calendario de pagos y sección de pagaré enmarcada con espacio de firma para el deudor, sin aval. La vista previa permite imprimir y compartir; para 10 pagos, el contenido cabe en una página.',
    userBenefit = N'Identifica cada préstamo del cliente y entrega la nota correspondiente con el desglose de capital e interés.',
    promoText = N'Abre el préstamo que necesitas y genera su pagaré con cada mensualidad detallada.',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.556' AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 19/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261119_cobranza_telegram_corte_fecha_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version IN (N'5.00.562', N'5.00.563') AND module = N'Cobranza / Corte y Telegram'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, createdAtUtc, updatedAtUtc, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.563', N'Cobranza / Corte y Telegram', N'FIX',
        N'Fecha local en cobros y corte de Cobranza',
        N'Telegram muestra la fecha del cobro antes y después de confirmarlo y guarda esa misma fecha según la hora local. El corte convierte a hora local la fecha UTC del turno antes de llenar el período, para evitar un rango invertido entre Desde y Hasta.',
        N'El usuario confirma qué día se registrará el cobro y puede consultarlo en el corte de ese mismo día.',
        N'Confirma la fecha al registrar en Telegram y encuentra el cobro en el período correcto del corte.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis',
        N'PENDING', N'LOCAL', N'PUBLISHED', SYSUTCDATETIME(),
        NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

UPDATE dbo.product_updates
SET version = N'5.00.563',
    description = N'Telegram muestra la fecha del cobro antes y después de confirmarlo y guarda esa misma fecha local. El corte interpreta los valores de fecha y hora UTC que devuelve SQL al llenar Desde, evitando que el inicio del turno aparezca como el día siguiente y quede después de Hasta.',
    userBenefit = N'El usuario confirma el día del cobro y puede consultarlo en un período válido del corte.',
    promoText = N'Confirma la fecha en Telegram y consulta el cobro sin invertir el rango del corte.',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version IN (N'5.00.562', N'5.00.563') AND module = N'Cobranza / Corte y Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.563' AND module = N'Cobranza / Corte y Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 20/11/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261120_almacen_origen_pdf_entradas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.587'
      AND module = N'Almacenes / Entradas'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.587', N'Almacenes / Entradas', N'IMPROVEMENT',
        N'Almacén de origen visible en el PDF de entradas',
        N'El PDF de cada movimiento de entrada muestra el nombre del almacén bajo el encabezado Almacén Origen, incluidos Recepción de compras y otros movimientos.',
        N'Permite identificar en el comprobante a qué almacén corresponde la recepción.',
        N'Consulta el almacén de origen directamente en el PDF de tus entradas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.587'
  AND module = N'Almacenes / Entradas'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 20/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261120_cobranza_corte_caja_por_cobrador_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.585'
      AND module = N'Cobranza / Corte de caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.585', N'Cobranza / Corte de caja', N'IMPROVEMENT',
        N'Resumen de caja y ahorro por cobrador',
        N'El corte de caja muestra por cobrador el fondo inicial, los abonos del período, el efectivo esperado y contado al cerrar, la diferencia y el saldo personal de ahorro. El saldo de ahorro se presenta por separado y no se suma al efectivo de caja. El PDF incluye el mismo resumen.',
        N'Permite revisar los cobros y el estado del corte de cada cobrador, además de consultar su ahorro sin mezclarlo con el efectivo de caja.',
        N'Consulta en el corte de cobranza el fondo inicial, los cobros y el ahorro de cada cobrador, también en PDF.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.585'
  AND module = N'Cobranza / Corte de caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 20/11/2026
-- Módulo: Compras
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261120_compras_crear_gasto_destino_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.586'
      AND module = N'Compras / Órdenes de compra'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.586', N'Compras / Órdenes de compra', N'FIX',
        N'Creación del gasto destino de la orden de compra',
        N'Al crear un gasto destino desde una orden de compra, se prepara el tipo contable GASTO DE LA OC si aún no existe. Si la empresa solo tiene una cuenta bancaria y un tipo disponibles, el gasto se crea y vincula directamente; con varias opciones se conservan los selectores.',
        N'Evita que la falta del tipo contable impida crear el gasto destino de una orden de compra.',
        N'Crea el gasto destino de tu orden de compra sin detenerte por falta del tipo contable.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.586'
  AND module = N'Compras / Órdenes de compra'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 20/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261120_public_demo_direct_access_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.588'
      AND module = N'Acceso / Demo'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.588', N'Acceso / Demo', N'IMPROVEMENT',
        N'Acceso directo a la empresa demo',
        N'Al abrir /demo, BIAPP inicia sesión con la cuenta de demostración y dirige al usuario a la empresa asignada a esa cuenta.',
        N'Permite explorar la empresa demo sin escribir credenciales ni elegir la empresa manualmente.',
        N'Abre la demo de BIAPP directamente desde www.biapp.com.mx/demo.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.588'
  AND module = N'Acceso / Demo'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 20/11/2026
-- Módulo: Almacenes / Inventario y movimientos
-- Repositorio de origen: MicroserviciosWarehouse
-- Archivo original: Warehouse/Sql/20261120_detailsinandout_comment.sql-- ============================================================================
use warehouses;
IF COL_LENGTH(N'dbo.Detailsinandout', N'comment') IS NULL
BEGIN
    ALTER TABLE dbo.Detailsinandout ADD comment NVARCHAR(500) NULL;
END;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_abonos_web_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.600'
      AND module = N'Cobranza / Calendario y abonos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.600', N'Cobranza / Calendario y abonos', N'IMPROVEMENT',
        N'Abonos web conectados con el calendario de Cobranza',
        N'Los abonos capturados desde la web publican el evento de Cobranza y actualizan el tablero con los saldos actuales de las cuotas programadas, vencidas y próximas. El aviso distingue los abonos capturados en la web de los recibidos desde Telegram.',
        N'Mantiene visible el estado de los vencimientos y refleja el efecto de los abonos web sin recargar manualmente el tablero.',
        N'Consulta vencimientos y próximos pagos; los abonos de la web actualizan el tablero al instante.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.600'
  AND module = N'Cobranza / Calendario y abonos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_clientes_atrasos_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.599'
      AND module = N'Cobranza / Clientes y Caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.599', N'Cobranza / Clientes y Caja', N'IMPROVEMENT',
        N'Consulta de cuotas vencidas y aviso de atraso en los cobros',
        N'El listado de clientes muestra el saldo vencido y las cuotas vencidas aún sin cubrir. El aviso en tiempo real de un cobro desde Telegram también indica el saldo vencido que queda y cuántas cuotas siguen atrasadas después del abono.',
        N'Permite detectar atrasos pendientes desde Caja y revisar la cartera vencida sin abrir cada préstamo.',
        N'Recibe el aviso del cobro y consulta cuántas cuotas vencidas conserva el cliente, con el saldo atrasado a la vista.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.599'
  AND module = N'Cobranza / Clientes y Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_clientes_cobrador_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.590'
      AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.590', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Asignación de cobradores a clientes',
        N'Al agregar un cliente se puede seleccionar su cobrador o vendedor; la asignación también se puede cambiar desde el listado.',
        N'Permite saber qué responsable atiende a cada cliente y reasignarlo cuando sea necesario.',
        N'Asigna cada cliente de cobranza a su vendedor y consulta al responsable en el listado.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.590'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_clientes_edicion_modal_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.593'
      AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.593', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Edición de clientes desde el modal',
        N'Al hacer doble clic en los datos de un cliente se abre la ventana con su información y el cobrador asignado para editarla y guardarla.',
        N'Permite cambiar el responsable y corregir datos desde un formulario claro, sin editar varias celdas del listado.',
        N'Abre un cliente con doble clic y actualiza sus datos y cobrador en una sola ventana.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.593'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_clientes_modal_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.589'
      AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.589', N'Cobranza / Clientes', N'IMPROVEMENT',
        N'Alta de clientes en ventana modal',
        N'El botón Agregar abre una ventana para capturar y guardar un cliente nuevo. El formulario valida nombre, sucursal y los datos opcionales antes del alta.',
        N'Permite registrar clientes sin editar una fila vacía del listado y muestra el registro al terminar.',
        N'Agrega clientes de cobranza desde una ventana con todos sus datos principales.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.589'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_cobranza_clientes_y_prestamos_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.598'
      AND module = N'Cobranza / Clientes y préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.598', N'Cobranza / Clientes y préstamos', N'IMPROVEMENT',
        N'Clientes por cobrador y nuevas frecuencias de préstamo',
        N'Se agregó un reporte PDF que agrupa los clientes por el cobrador asignado. Los préstamos permiten programar pagos diarios, semanales, quincenales o mensuales, capturar el interés total y consultar el porcentaje equivalente sobre el capital. El interés total se distribuye entre las cuotas.',
        N'Permite consultar la cartera de cada cobrador y adaptar el calendario y el interés total del préstamo.',
        N'Consulta los clientes de cada cobrador y crea calendarios flexibles con el interés total del préstamo a la vista.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.598'
  AND module = N'Cobranza / Clientes y préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_deleted_users_company_permission_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.592'
      AND module = N'Usuarios / Recuperación'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.592', N'Usuarios / Recuperación', N'FIX',
        N'Búsqueda de usuarios borrados por empresa asignada',
        N'La consulta y restauración de cuentas borradas reconoce la empresa asignada mediante sus permisos, aunque la cuenta no tenga id_company directo.',
        N'Permite encontrar y recuperar cuentas borradas asignadas a la empresa seleccionada.',
        N'Encuentra y recupera las cuentas borradas asignadas a tu empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.592'
  AND module = N'Usuarios / Recuperación'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_personalized_quick_actions_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.594'
      AND module = N'Navegación / Favoritos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.594', N'Navegación / Favoritos', N'IMPROVEMENT',
        N'Favoritos personalizados según el uso',
        N'Las tres pantallas internas más visitadas se muestran como favoritos, con el uso guardado por correo en el navegador.',
        N'Permite volver rápidamente a las pantallas más utilizadas por cada persona.',
        N'Tus pantallas más utilizadas quedan a un clic en Favoritos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.594'
  AND module = N'Navegación / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_telegram_cobranza_cliente_direccion_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.597'
      AND module = N'Cobranza / Telegram'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.597', N'Cobranza / Telegram', N'IMPROVEMENT',
        N'Domicilio del cliente visible al seleccionarlo en Telegram',
        N'Al seleccionar un cliente encontrado en Cobranza, Telegram muestra la dirección registrada con los componentes disponibles: calle, colonia, ciudad, estado y código postal.',
        N'Ayuda al cobrador a confirmar que encontró al cliente correcto antes de registrar la visita o el pago.',
        N'Confirma el domicilio del cliente desde Telegram antes de registrar la visita.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.597'
  AND module = N'Cobranza / Telegram'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_telegram_cobranza_realtime_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.596'
      AND module = N'Cobranza / Telegram y Caja'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.596', N'Cobranza / Telegram y Caja', N'IMPROVEMENT',
        N'Aviso de cobro de Telegram en Caja',
        N'Cuando un cobrador registra un pago desde Telegram, los usuarios autenticados y autorizados en esa empresa reciben en Caja un aviso en tiempo real con cliente, monto y cobrador.',
        N'Permite enterarse de los pagos del equipo sin actualizar la pantalla manualmente.',
        N'Recibe en Caja un aviso al instante cada vez que un cobrador registra un pago desde Telegram.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.596'
  AND module = N'Cobranza / Telegram y Caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_user_password_favorites_fix_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.595'
      AND module = N'Usuarios / Favoritos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.595', N'Usuarios / Favoritos', N'FIX',
        N'Protección de contraseña y rutas útiles en favoritos',
        N'La edición de permisos no altera contraseñas existentes y los favoritos omiten rutas contenedoras vacías y presentan nombres de pantalla limpios.',
        N'Evita perder acceso al modificar permisos y permite abrir favoritos claros y útiles.',
        N'Actualiza permisos sin cambiar contraseñas y abre favoritos claros y útiles.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.595'
  AND module = N'Usuarios / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 21/11/2026
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261121_users_deleted_root_restore_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.591'
      AND module = N'Usuarios / Recuperación'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.591', N'Usuarios / Recuperación', N'IMPROVEMENT',
        N'Recuperación protegida de usuarios borrados por empresa',
        N'El root de cada empresa puede consultar los usuarios borrados y restaurarlos únicamente dentro de la empresa seleccionada. Security valida el alcance por empresa y oculta usuarios inactivos a los demás usuarios.',
        N'Permite recuperar cuentas desactivadas sin exponer usuarios borrados de otras empresas.',
        N'Recupera usuarios borrados de tu empresa desde el acceso root.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.591'
  AND module = N'Usuarios / Recuperación'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_aviso_cuotas_vencidas_clientes_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.607'
      AND module = N'Cobranza / Clientes'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.607', N'Cobranza / Clientes', N'FEATURE',
        N'Aviso visible de cuotas vencidas en Clientes',
        N'La lista de Clientes muestra la cantidad de personas y cuotas vencidas, el saldo pendiente y un acceso directo al filtro de vencidos; se actualiza al guardar cambios del calendario.',
        N'Permite detectar pagos atrasados y consultar los clientes afectados desde la lista principal.',
        N'Identifica de inmediato a tus clientes con pagos vencidos y consulta su saldo pendiente.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.607'
  AND module = N'Cobranza / Clientes'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Administración / General
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_aviso_global_cuotas_vencidas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.608'
      AND module = N'Cobranza / Avisos globales'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.608', N'Cobranza / Avisos globales', N'FEATURE',
        N'Aviso global de cuotas vencidas',
        N'El aviso de vencimientos aparece en la barra principal al entrar al sistema y permanece visible entre módulos. Se actualiza al recibir un cobro, regresar a la ventana o cada cinco minutos.',
        N'Mantiene los atrasos visibles sin importar qué pantalla esté usando el usuario y permite abrir Clientes de Cobranza desde el aviso.',
        N'Consulta los pagos vencidos desde cualquier módulo y entra a Cobranza con un clic.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.608'
  AND module = N'Cobranza / Avisos globales'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_cobranza_actualizar_calendario_sin_duplicar_cuotas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.605'
      AND module = N'Cobranza / Préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.605', N'Cobranza / Préstamos', N'FIX',
        N'Actualización del calendario sin duplicar cuotas',
        N'Al modificar fechas o condiciones del préstamo, el servicio actualiza las cuotas existentes y conserva la restricción única de número de cuota por préstamo.',
        N'Permite guardar los cambios de calendario sin errores por números de cuota duplicados.',
        N'Ajusta las fechas del préstamo y guarda el calendario sin duplicar sus cuotas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.605'
  AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_cobranza_editar_fechas_cuotas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.601'
      AND module = N'Cobranza / Calendario de préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.601', N'Cobranza / Calendario de préstamos', N'IMPROVEMENT',
        N'Edición de fechas del calendario de cuotas',
        N'Cada préstamo cuenta con una opción para habilitar la edición de fechas programadas. Los cambios se pueden guardar o deshacer sin modificar los montos ni los abonos registrados.',
        N'Facilita ajustar los vencimientos del préstamo y conservar el historial de pagos.',
        N'Ajusta las fechas de pago de cada préstamo y conserva su historial de abonos.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.601'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_cobranza_normalizar_fecha_cuota_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.602'
      AND module = N'Cobranza / Calendario de préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.602', N'Cobranza / Calendario de préstamos', N'FIX',
        N'Guardado de fechas seleccionadas en las cuotas',
        N'El calendario normaliza el valor recibido del editor de fecha antes de validarlo y guardarlo, para conservar el día seleccionado por el usuario.',
        N'Evita que la cuota vuelva a la fecha anterior al cambiar su vencimiento.',
        N'Cambia la fecha programada de una cuota y guarda el día que seleccionaste.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.602'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_cobranza_verificar_cabecera_prestamo_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.604'
      AND module = N'Cobranza / Préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.604', N'Cobranza / Préstamos', N'FIX',
        N'Confirmación de cambios en la cabecera del préstamo',
        N'La edición de la nota y las fechas de la cabecera consulta el registro después del guardado, confirma los valores y presenta el mensaje devuelto por la API cuando no puede actualizarse.',
        N'Permite conocer si la nota y las fechas quedaron guardadas o por qué se rechazó el cambio.',
        N'Actualiza los datos del préstamo y conoce por qué no se guardó si ocurre un error.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.604'
  AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_cobranza_verificar_fecha_y_mostrar_vencida_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.603'
      AND module = N'Cobranza / Calendario de préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.603', N'Cobranza / Calendario de préstamos', N'FIX',
        N'Estado de cuotas vencidas y verificación de fechas',
        N'El detalle marca como vencidas las cuotas pendientes con fecha anterior a hoy y verifica en la respuesta de la API que cada fecha modificada haya quedado guardada.',
        N'Permite identificar el atraso en el calendario y confirmar el cambio de vencimiento.',
        N'Detecta cuotas vencidas y confirma que la nueva fecha quedó guardada.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.603'
  AND module = N'Cobranza / Calendario de préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 22/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261122_favorito_ruta_clientes_cobranza_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.606'
      AND module = N'Navegación / Favoritos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.606', N'Navegación / Favoritos', N'FIX',
        N'Ruta estable para el favorito de Clientes de Cobranza',
        N'El favorito de Clientes de Cobranza utiliza la ruta canónica y reconoce los favoritos guardados anteriormente para evitar duplicados.',
        N'Permite abrir Clientes desde el favorito aunque se hubiera guardado con una ruta dinámica anterior.',
        N'Abre Clientes de Cobranza desde tus favoritos con un solo clic.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.606'
  AND module = N'Navegación / Favoritos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261123_cobranza_avisos_pagos_proximos_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.609'
      AND module = N'Cobranza / Avisos de pago'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.609', N'Cobranza / Avisos de pago', N'FEATURE',
        N'Recordatorios de pagos próximos para cobradores y administración',
        N'Administración publica por RabbitMQ las cuotas pendientes programadas para hoy y mañana. Telegram las envía al usuario asignado como cobrador; la web muestra un resumen global en vivo y al iniciar sesión. El registro de envío evita duplicados por cuota y fecha.',
        N'Ayuda al cobrador a organizar sus visitas y permite a la administradora anticipar los cobros pendientes.',
        N'Anticipa las cobranzas del día y del siguiente desde Telegram y desde cualquier pantalla web.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.609'
  AND module = N'Cobranza / Avisos de pago'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261123_cobranza_edicion_fechas_cuotas_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.610'
      AND module = N'Cobranza / Calendario de pagos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.610', N'Cobranza / Calendario de pagos', N'FIX',
        N'Edición estable de fechas programadas',
        N'Las fechas de las cuotas se editan con un clic. El selector no cierra la edición al elegir la fecha y la sincronización automática se pausa durante la captura.',
        N'Permite cambiar y guardar las fechas del calendario sin perder la edición.',
        N'Actualiza las fechas de pago del préstamo desde el calendario, sin perder la edición.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.610'
  AND module = N'Cobranza / Calendario de pagos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Cobranza
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261123_cobranza_offline_ocho_horas_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.611'
      AND module = N'Cobranza / Caja web'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.611', N'Cobranza / Caja web', N'IMPROVEMENT',
        N'Operación offline de Cobranza durante hasta ocho horas',
        N'La caja web puede preparar localmente clientes, préstamos, cuotas, catálogos y datos de caja. Con una sesión previamente validada, permite operar Cobranza sin conexión hasta ocho horas y sincroniza los registros locales al recuperar internet.',
        N'Permite continuar la operación de la caja cuando se interrumpe internet y enviar los movimientos pendientes cuando vuelve la conexión.',
        N'Sigue cobrando durante una interrupción de internet: Cobranza guarda los movimientos en la caja y los sincroniza al recuperar conexión, con acceso offline de hasta ocho horas.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'PRODUCTION', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET validationStatus = N'PASSED',
    releaseStatus = N'PRODUCTION',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.611'
  AND module = N'Cobranza / Caja web'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.611'
  AND module = N'Cobranza / Caja web'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261123_inventario_acceso_directo_kardex_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.613'
      AND module = N'Almacenes / Inventario'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.613', N'Almacenes / Inventario y Kardex', N'IMPROVEMENT',
        N'Acceso al Kardex desde el inventario',
        N'Se agregó la columna Kardex inmediatamente después de Existencia. Al abrir el historial de un material, la consulta ahora filtra desde el servidor y devuelve solo sus movimientos en los almacenes autorizados, en una sola solicitud.',
        N'Abre el historial desde Inventario y reduce la espera al evitar descargar movimientos y detalles de otros materiales.',
        N'Consulta más rápido el Kardex de cualquier material desde Inventario.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.613'
  AND module = N'Almacenes / Inventario'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/20261123_kardex_alcance_por_almacen_product_update.sql-- ============================================================================
USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.612'
      AND module = N'Almacenes / Kardex'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.612', N'Almacenes / Kardex', N'FIX',
        N'Consulta de Kardex con alcance por almacén',
        N'El Kardex consulta las entradas y salidas de los almacenes autorizados sin filtrar por proyecto, de acuerdo con el alcance utilizado por Inventario.',
        N'Muestra en Kardex las entradas y salidas que forman la existencia del almacén aunque no tengan proyecto asignado.',
        N'Consulta en Kardex los movimientos que componen la existencia del almacén, aunque no tengan proyecto asignado.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'PRODUCTION', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

UPDATE dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
SET validationStatus = N'PASSED',
    releaseStatus = N'PRODUCTION',
    updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.612'
  AND module = N'Almacenes / Kardex'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

COMMIT TRANSACTION;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.612'
  AND module = N'Almacenes / Kardex'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO
-- ============================================================================
-- Fecha: Fecha no indicada en el nombre original
-- Módulo: Administración / Novedades del producto
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/create_product_updates.sql-- ============================================================================
use administration;
/*
  Registro de cambios del producto para alimentar Novedades/Publicidad.
  SQL Server. Las fechas se almacenan en UTC; la zona indica cómo mostrarlas.
*/
IF OBJECT_ID(N'dbo.product_updates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_updates
    (
        id                    BIGINT IDENTITY(1,1) NOT NULL,
        idRoot                INT NULL,
        idCompany             INT NULL,
        version               NVARCHAR(40) NULL,
        module                NVARCHAR(120) NOT NULL,
        changeType            VARCHAR(20) NOT NULL,
        title                 NVARCHAR(180) NOT NULL,
        description           NVARCHAR(MAX) NOT NULL,
        userBenefit           NVARCHAR(600) NULL,
        promoText             NVARCHAR(600) NULL,
        occurredAtUtc         DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_occurredAtUtc DEFAULT SYSUTCDATETIME(),
        displayTimeZone       NVARCHAR(80) NOT NULL
            CONSTRAINT DF_product_updates_displayTimeZone DEFAULT N'America/Indiana/Indianapolis',
        validationStatus      VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_validationStatus DEFAULT 'PENDING',
        releaseStatus         VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_releaseStatus DEFAULT 'LOCAL',
        publicationStatus     VARCHAR(20) NOT NULL
            CONSTRAINT DF_product_updates_publicationStatus DEFAULT 'DRAFT',
        mediaUrl              NVARCHAR(1000) NULL,
        tutorialUrl           NVARCHAR(1000) NULL,
        publishedAtUtc        DATETIME2(0) NULL,
        createdBy              NVARCHAR(160) NULL,
        createdAtUtc           DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_createdAtUtc DEFAULT SYSUTCDATETIME(),
        updatedAtUtc           DATETIME2(0) NOT NULL
            CONSTRAINT DF_product_updates_updatedAtUtc DEFAULT SYSUTCDATETIME(),
        isActive               BIT NOT NULL
            CONSTRAINT DF_product_updates_isActive DEFAULT 1,

        CONSTRAINT PK_product_updates PRIMARY KEY CLUSTERED (id),
        CONSTRAINT CK_product_updates_changeType
            CHECK (changeType IN ('FEATURE', 'IMPROVEMENT', 'FIX', 'TIP', 'SECURITY', 'PERFORMANCE')),
        CONSTRAINT CK_product_updates_validationStatus
            CHECK (validationStatus IN ('PENDING', 'PASSED', 'FAILED')),
        CONSTRAINT CK_product_updates_releaseStatus
            CHECK (releaseStatus IN ('LOCAL', 'TEST', 'PRODUCTION')),
        CONSTRAINT CK_product_updates_publicationStatus
            CHECK (publicationStatus IN ('DRAFT', 'READY', 'PUBLISHED', 'HIDDEN'))
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.product_updates')
      AND name = N'IX_product_updates_publicity'
)
BEGIN
    CREATE INDEX IX_product_updates_publicity
        ON dbo.product_updates (publicationStatus, isActive, occurredAtUtc DESC)
        INCLUDE (idRoot, idCompany, version, module, changeType, title, userBenefit, promoText, mediaUrl, tutorialUrl);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.product_updates')
      AND name = N'IX_product_updates_tenant_history'
)
BEGIN
    CREATE INDEX IX_product_updates_tenant_history
        ON dbo.product_updates (idRoot, idCompany, occurredAtUtc DESC)
        INCLUDE (version, module, changeType, title, validationStatus, releaseStatus, publicationStatus, isActive);
END;
GO
-- ============================================================================
-- Fecha: Fecha no indicada en el nombre original
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/security_password_hash_column.sql-- ============================================================================
use security;
/*
  Ejecutar una sola vez conectado a la base Security antes de desplegar el
  backend que almacena hashes de contraseña. No contiene credenciales de
  conexión ni cambia contraseñas de usuarios.
*/
IF COL_LENGTH(N'dbo.Users', N'Password') IS NOT NULL
   AND EXISTS (
       SELECT 1
       FROM sys.columns
       WHERE object_id = OBJECT_ID(N'dbo.Users')
         AND name = N'Password'
         AND max_length < 510 -- NVARCHAR(255) ocupa 510 bytes
   )
BEGIN
    ALTER TABLE dbo.Users
    ALTER COLUMN [Password] NVARCHAR(255) NULL;
END;
GO
-- ============================================================================
-- Fecha: Fecha no indicada en el nombre original
-- Módulo: Administración / Usuarios y permisos
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/security_users_name_lengths.sql-- ============================================================================
-- Ejecutar en la base de datos de Seguridad.
-- Nombre de usuario: dbo.Users.usersmall, de 20 a 50 caracteres.
-- Nombre: dbo.Users.DisplayName, de 100 a 150 caracteres.
-- También deben actualizarse los atributos StringLength del backend.
-- Conserva el tipo de dato y la nulabilidad de las columnas.
SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @tableId int = OBJECT_ID(N'dbo.Users', N'U');
    IF @tableId IS NULL
        THROW 50001, 'No existe dbo.Users. Verifique la base de datos seleccionada.', 1;

    IF (SELECT COUNT(*) FROM sys.columns
        WHERE object_id = @tableId AND name IN (N'usersmall', N'DisplayName')) <> 2
        THROW 50002, 'No se encontraron las dos columnas esperadas en dbo.Users.', 1;

    IF EXISTS (
        SELECT 1 FROM sys.columns c
        JOIN sys.types t ON t.user_type_id = c.user_type_id
        WHERE c.object_id = @tableId
          AND c.name IN (N'usersmall', N'DisplayName')
          AND (t.name NOT IN (N'varchar', N'nvarchar') OR t.is_user_defined = 1)
    )
        THROW 50003, 'Las columnas deben ser varchar o nvarchar sin tipos personalizados.', 1;

    DECLARE @sql nvarchar(max) = N'';

    SELECT @sql +=
        N'ALTER TABLE dbo.Users ALTER COLUMN ' + QUOTENAME(c.name)
        + N' ' + QUOTENAME(t.name)
        + N'(' + CAST(v.limite AS nvarchar(10)) + N')'
        + N' COLLATE ' + QUOTENAME(c.collation_name)
        + CASE WHEN c.is_nullable = 1 THEN N' NULL;' ELSE N' NOT NULL;' END
        + CHAR(13) + CHAR(10)
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    JOIN (VALUES
        (N'usersmall', 50),
        (N'DisplayName', 150)
    ) v(campo, limite) ON c.name = v.campo
    WHERE c.object_id = @tableId
      -- Solo ampliar: conservar columnas que ya tengan un limite mayor o MAX.
      AND c.max_length <> -1
      AND c.max_length < v.limite * CASE WHEN t.name = N'nvarchar' THEN 2 ELSE 1 END;

    IF LEN(@sql) > 0
        EXEC sys.sp_executesql @sql;

    COMMIT TRANSACTION;

    SELECT c.name AS Campo, t.name AS Tipo,
           CASE WHEN c.max_length = -1 THEN -1
                WHEN t.name = N'nvarchar' THEN c.max_length / 2
                ELSE c.max_length END AS LimiteCaracteres,
           c.is_nullable AS PermiteNulos
    FROM sys.columns c
    JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = @tableId
      AND c.name IN (N'usersmall', N'DisplayName');
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
-- ============================================================================
-- Fecha: Fecha no indicada en el nombre original
-- Módulo: Administración / SMP
-- Repositorio de origen: Smp25
-- Archivo original: docs/sql/smp_risk_setup.sql-- ============================================================================
USE [smp];
GO

IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'smp')
BEGIN
    EXEC('CREATE SCHEMA [smp]');
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[smp].[RiskIdentification]') AND type = 'U')
BEGIN
    CREATE TABLE [smp].[RiskIdentification] (
        [Id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [IdProject]       INT NOT NULL,
        [IdContract]      INT NULL,
        [IdWorkProgram]   INT NULL,
        [Scope]           VARCHAR(20) NOT NULL,
        [Folio]           VARCHAR(30) NOT NULL,
        [Title]           VARCHAR(200) NOT NULL,
        [Description]     VARCHAR(1000) NOT NULL,
        [Cause]           VARCHAR(1000) NULL,
        [Consequence]     VARCHAR(1000) NULL,
        [Category]        VARCHAR(100) NOT NULL,
        [Probability]     INT NOT NULL,
        [ImpactTimeDays]  DECIMAL(10,2) NOT NULL CONSTRAINT [DF_RiskIdentification_ImpactTimeDays] DEFAULT (0),
        [ImpactCost]      DECIMAL(18,2) NOT NULL CONSTRAINT [DF_RiskIdentification_ImpactCost] DEFAULT (0),
        [Criticality]     INT NOT NULL,
        [TrafficLight]    VARCHAR(20) NOT NULL,
        [Responsible]     VARCHAR(150) NOT NULL,
        [ResponsePlan]    VARCHAR(2000) NOT NULL,
        [DueDate]         DATE NOT NULL,
        [Status]          VARCHAR(30) NOT NULL,
        [Notes]           VARCHAR(2000) NULL,
        [Active]          BIT NOT NULL CONSTRAINT [DF_RiskIdentification_Active] DEFAULT (1),
        [CreatedAt]       DATETIME NOT NULL CONSTRAINT [DF_RiskIdentification_CreatedAt] DEFAULT (GETDATE()),
        [CreatedBy]       VARCHAR(100) NULL,
        [UpdatedAt]       DATETIME NULL,
        [UpdatedBy]       VARCHAR(100) NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_Folio' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE UNIQUE INDEX [IX_RiskIdentification_Folio]
        ON [smp].[RiskIdentification]([Folio]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_Project' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE INDEX [IX_RiskIdentification_Project]
        ON [smp].[RiskIdentification]([IdProject], [Active]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskIdentification_WorkProgram' AND object_id = OBJECT_ID(N'[smp].[RiskIdentification]'))
BEGIN
    CREATE INDEX [IX_RiskIdentification_WorkProgram]
        ON [smp].[RiskIdentification]([IdWorkProgram]);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'[smp].[RiskFollowUp]') AND type = 'U')
BEGIN
    CREATE TABLE [smp].[RiskFollowUp] (
        [Id]              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [IdRisk]          INT NOT NULL,
        [Comment]         VARCHAR(2000) NOT NULL,
        [PreviousStatus]  VARCHAR(30) NULL,
        [NewStatus]       VARCHAR(30) NULL,
        [ProgressPercent] DECIMAL(5,2) NULL,
        [CreatedAt]       DATETIME NOT NULL CONSTRAINT [DF_RiskFollowUp_CreatedAt] DEFAULT (GETDATE()),
        [CreatedBy]       VARCHAR(100) NULL,
        CONSTRAINT [FK_RiskFollowUp_RiskIdentification]
            FOREIGN KEY ([IdRisk]) REFERENCES [smp].[RiskIdentification]([Id])
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_RiskFollowUp_Risk' AND object_id = OBJECT_ID(N'[smp].[RiskFollowUp]'))
BEGIN
    CREATE INDEX [IX_RiskFollowUp_Risk]
        ON [smp].[RiskFollowUp]([IdRisk], [CreatedAt] DESC);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'SeqRiskFolio' AND SCHEMA_NAME(schema_id) = 'smp')
BEGIN
    CREATE SEQUENCE [smp].[SeqRiskFolio]
        AS INT
        START WITH 1
        INCREMENT BY 1;
END
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'microservicio')
BEGIN
    GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::[smp] TO [microservicio];
    GRANT REFERENCES ON SCHEMA::[smp] TO [microservicio];
    GRANT EXECUTE ON SCHEMA::[smp] TO [microservicio];
END
GO

/*
Ejemplo para generar folio:
SELECT CONCAT('RISK-', RIGHT('000' + CAST(NEXT VALUE FOR [smp].[SeqRiskFolio] AS VARCHAR(10)), 3));
*/
GO

-- ============================================================================
-- Fecha: 23/11/2026
-- Módulo: Almacenes / Inventario
-- Repositorio de origen: Smp25
-- Archivo original: agregado al archivo maestro (versión 5.00.614)
-- ============================================================================
USE administration;
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.614'
      AND module = N'Almacenes / Inventario'
      AND idRoot IS NULL
      AND idCompany IS NULL
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.614', N'Almacenes / Inventario', N'IMPROVEMENT',
        N'Consulta movimientos desde Inventario',
        N'Se agregó búsqueda por código, descripción y marca, además de un detalle expandible debajo de cada material con el historial de entradas, salidas, folios, fechas, referencias y saldo.',
        N'Permite localizar materiales y revisar su historial sin salir de Inventario ni perder el contexto de las existencias.',
        N'Busca un material y despliega sus movimientos directamente debajo de su fila en Inventario.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;

COMMIT TRANSACTION;
GO

/*
  Fecha: 2026-11-23
  Hora local: 15:24 America/Indiana/Indianapolis
  Módulo: Configuración / Consecutivos
  Repositorio origen: Smp25 (front-end) / MicroServicioAdministration (API)
  Propósito: Crear en el esquema `cobranzas` el catálogo de prefijo y siguiente número aislado por empresa.
  Aplicar en la base de datos de Administración.
*/
IF SCHEMA_ID(N'cobranzas') IS NULL
    EXEC(N'CREATE SCHEMA cobranzas');
GO

IF OBJECT_ID(N'cobranzas.consecutivos', N'U') IS NULL
   AND OBJECT_ID(N'configuracion.consecutivos', N'U') IS NOT NULL
BEGIN
    ALTER SCHEMA cobranzas TRANSFER configuracion.consecutivos;
END;
GO

IF OBJECT_ID(N'cobranzas.consecutivos', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.consecutivos
    (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cobranzas_consecutivos PRIMARY KEY,
        id_root INT NOT NULL,
        consecutivo NVARCHAR(40) NOT NULL,
        campo_auxiliar INT NOT NULL CONSTRAINT DF_cobranzas_consecutivos_campo_auxiliar DEFAULT (1),
        CONSTRAINT CK_cobranzas_consecutivos_campo_auxiliar CHECK (campo_auxiliar >= 1)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'cobranzas.consecutivos')
      AND name IN (N'UX_cobranzas_consecutivos_root_prefijo', N'UX_configuracion_consecutivos_root_prefijo')
)
BEGIN
    CREATE UNIQUE INDEX UX_cobranzas_consecutivos_root_prefijo
        ON cobranzas.consecutivos (id_root, consecutivo);
END;
GO

/* Novedad de producto: publicación pendiente; el código aún no está desplegado. */
IF OBJECT_ID(N'dbo.product_updates', N'U') IS NOT NULL
AND NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.616'
      AND module = N'Cobranza / Configuración'
      AND idRoot IS NULL
      AND idCompany IS NULL
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.616', N'Cobranza / Configuración', N'IMPROVEMENT',
        N'Configuración de consecutivos en Cobranza',
        N'Se agregó en Cobranza una pantalla para administrar prefijos y el siguiente número de folio por empresa, visible mediante el menú dinámico del módulo. La API permite reservar números sin repetirlos.',
        N'Permite mantener consecutivos independientes por empresa y preparar su uso desde los procesos que generen documentos.',
        N'Administra desde Configuración de Cobranza los prefijos y siguientes números de folio de cada empresa.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PENDING', N'LOCAL', N'DRAFT',
        NULL, NULL, SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;
GO

/*
Fecha: 2026-11-23
Módulo: Administración de acceso SQL para MCP de BIAPP
Repositorio: Smp25
Origen: solicitud del usuario para permitir consultas de solo lectura en todos los esquemas de las bases de datos de microservicios.
IMPORTANTE: ejecutar únicamente este bloque; no ejecutar completo el archivo histórico.
*/
DECLARE @Base sysname;
DECLARE @SQL nvarchar(max);

DECLARE bases CURSOR LOCAL FAST_FORWARD FOR
    SELECT name
    FROM sys.databases
    WHERE database_id > 4
      AND state_desc = 'ONLINE';

OPEN bases;
FETCH NEXT FROM bases INTO @Base;

WHILE @@FETCH_STATUS = 0
BEGIN
    SET @SQL = N'USE ' + QUOTENAME(@Base) + N';

    IF DATABASE_PRINCIPAL_ID(N''Microservicio'') IS NULL
    BEGIN
        PRINT N''OMITIDA: '' + DB_NAME() + N'' (no existe el usuario Microservicio)'';
    END
    ELSE
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM sys.database_role_members rm
            JOIN sys.database_principals rol
              ON rol.principal_id = rm.role_principal_id
            JOIN sys.database_principals usr
              ON usr.principal_id = rm.member_principal_id
            WHERE rol.name = N''db_datareader''
              AND usr.name = N''Microservicio''
        )
            ALTER ROLE db_datareader ADD MEMBER [Microservicio];

        GRANT VIEW DEFINITION TO [Microservicio];
        PRINT N''LISTA: '' + DB_NAME();
    END;';

    EXEC sys.sp_executesql @SQL;
    FETCH NEXT FROM bases INTO @Base;
END;

CLOSE bases;
DEALLOCATE bases;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Migración de tablas al esquema cobranzas
Repositorio: Smp25 / MicroServicioAdministration
Origen: solicitud del usuario para trasladar las seis tablas principales de Cobranza desde dbo.
IMPORTANTE: ejecutar únicamente este bloque después de confirmar el respaldo; no ejecutar completo el archivo histórico.
La transferencia conserva los datos y los identificadores de las tablas existentes.
*/
IF SCHEMA_ID(N'cobranzas') IS NULL
    EXEC(N'CREATE SCHEMA [cobranzas]');
GO

DECLARE @TablasCobranza TABLE (nombre sysname NOT NULL PRIMARY KEY);
INSERT INTO @TablasCobranza (nombre)
VALUES
    (N'abonos_cobranza'),
    (N'cortes_cobranza'),
    (N'cortes_cobranza_abonos'),
    (N'cuotas_cobranza'),
    (N'pagos_cobranzas'),
    (N'prestamos_cobranza');

DECLARE @NombreTabla sysname;
DECLARE @SQLTransferencia nvarchar(max);
DECLARE tablasCobranza CURSOR LOCAL FAST_FORWARD FOR
    SELECT nombre FROM @TablasCobranza ORDER BY nombre;

BEGIN TRY
    BEGIN TRANSACTION;
    OPEN tablasCobranza;
    FETCH NEXT FROM tablasCobranza INTO @NombreTabla;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF OBJECT_ID(N'dbo.' + @NombreTabla, N'U') IS NOT NULL
           AND OBJECT_ID(N'cobranzas.' + @NombreTabla, N'U') IS NOT NULL
        BEGIN
            DECLARE @Conflicto nvarchar(2048) = N'La tabla existe en dbo y cobranzas: ' + @NombreTabla + N'. Se canceló la migración para evitar duplicados.';
            ;THROW 51001, @Conflicto, 1;
        END;

        IF OBJECT_ID(N'dbo.' + @NombreTabla, N'U') IS NOT NULL
        BEGIN
            SET @SQLTransferencia = N'ALTER SCHEMA [cobranzas] TRANSFER [dbo].' + QUOTENAME(@NombreTabla) + N';';
            EXEC sys.sp_executesql @SQLTransferencia;
            PRINT N'MOVIDA: cobranzas.' + @NombreTabla;
        END
        ELSE IF OBJECT_ID(N'cobranzas.' + @NombreTabla, N'U') IS NOT NULL
        BEGIN
            PRINT N'YA ESTABA: cobranzas.' + @NombreTabla;
        END
        ELSE
        BEGIN
            DECLARE @Faltante nvarchar(2048) = N'No se encontró la tabla en dbo ni cobranzas: ' + @NombreTabla + N'. Se canceló la migración.';
            ;THROW 51002, @Faltante, 1;
        END;

        FETCH NEXT FROM tablasCobranza INTO @NombreTabla;
    END;

    CLOSE tablasCobranza;
    DEALLOCATE tablasCobranza;
    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF CURSOR_STATUS('local', 'tablasCobranza') >= 0
        CLOSE tablasCobranza;
    IF CURSOR_STATUS('local', 'tablasCobranza') >= -1
        DEALLOCATE tablasCobranza;
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Telegram (ubicación y visita sin pago)
Repositorio origen: ChatbotTelegram
Propósito: Asegurar que la ubicación de abonos y las visitas sin pago usen el esquema plural cobranzas.
IMPORTANTE: ejecutar únicamente este bloque después de la migración de las seis tablas principales.
*/
IF COL_LENGTH(N'cobranzas.abonos_cobranza', N'ubicacion_latitud') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD ubicacion_latitud DECIMAL(9,6) NULL;
GO

IF COL_LENGTH(N'cobranzas.abonos_cobranza', N'ubicacion_longitud') IS NULL
    ALTER TABLE cobranzas.abonos_cobranza ADD ubicacion_longitud DECIMAL(9,6) NULL;
GO

IF OBJECT_ID(N'cobranzas.cobranza_visitas_nopago', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cobranza_visitas_nopago
    (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cobranza_visitas_nopago PRIMARY KEY,
        id_root INT NOT NULL,
        id_usuario_cobrador INT NOT NULL,
        id_customer INT NOT NULL,
        id_prestamo INT NOT NULL,
        id_cuota INT NOT NULL,
        fecha_visita DATE NOT NULL,
        resultado VARCHAR(20) NOT NULL CONSTRAINT DF_cobranza_visitas_nopago_resultado DEFAULT ('NO_PAGO'),
        latitud DECIMAL(9,6) NULL,
        longitud DECIMAL(9,6) NULL,
        saldo_prestamo DECIMAL(18,2) NOT NULL,
        idempotency_key UNIQUEIDENTIFIER NOT NULL,
        active BIT NOT NULL CONSTRAINT DF_cobranza_visitas_nopago_active DEFAULT (1),
        created_at_utc DATETIME2(3) NOT NULL CONSTRAINT DF_cobranza_visitas_nopago_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_cobranza_visitas_nopago_resultado CHECK (resultado = 'NO_PAGO'),
        CONSTRAINT CK_cobranza_visitas_nopago_lat CHECK (latitud BETWEEN -90 AND 90),
        CONSTRAINT CK_cobranza_visitas_nopago_lon CHECK (longitud BETWEEN -180 AND 180)
    );

    CREATE UNIQUE INDEX UX_cobranza_visitas_nopago_key
        ON cobranzas.cobranza_visitas_nopago(idempotency_key);
    CREATE INDEX IX_cobranza_visitas_nopago_cobrador_fecha
        ON cobranzas.cobranza_visitas_nopago(id_root, id_usuario_cobrador, fecha_visita, active);
END;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Telegram / visitas sin pago sin ubicación obligatoria
Repositorio origen: ChatbotTelegram
Propósito: Conservar las columnas de coordenadas y permitir NULL al registrar visitas sin GPS.
IMPORTANTE: ejecutar únicamente este bloque en administration.
*/
IF OBJECT_ID(N'cobranzas.cobranza_visitas_nopago', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_visitas_nopago')
          AND name = N'latitud' AND is_nullable = 0
    )
        ALTER TABLE cobranzas.cobranza_visitas_nopago ALTER COLUMN latitud DECIMAL(9,6) NULL;

    IF EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_visitas_nopago')
          AND name = N'longitud' AND is_nullable = 0
    )
        ALTER TABLE cobranzas.cobranza_visitas_nopago ALTER COLUMN longitud DECIMAL(9,6) NULL;
END;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Fondo de ahorro de Telegram
Repositorio origen: ChatbotTelegram
Propósito: Mantener la creación idempotente de las tablas del fondo en cobranzas.
IMPORTANTE: ejecutar únicamente este bloque si se instala en una base que aún no tiene estas tablas.
*/
USE [administration];
GO

IF SCHEMA_ID(N'cobranzas') IS NULL EXEC(N'CREATE SCHEMA [cobranzas]');
GO

IF OBJECT_ID(N'cobranzas.cobranza_fondo_ahorro', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cobranza_fondo_ahorro
    (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cobranza_fondo_ahorro PRIMARY KEY,
        id_root INT NOT NULL,
        id_usuario_cobrador INT NOT NULL,
        saldo DECIMAL(18,2) NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_saldo DEFAULT (0),
        porcentaje_apartado DECIMAL(5,2) NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_porcentaje DEFAULT (0),
        active BIT NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_active DEFAULT (1),
        updated_at_utc DATETIME2(3) NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_updated DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_cobranza_fondo_ahorro_saldo CHECK (saldo >= 0),
        CONSTRAINT CK_cobranza_fondo_ahorro_porcentaje CHECK (porcentaje_apartado >= 0 AND porcentaje_apartado <= 100)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_fondo_ahorro')
      AND name = N'UX_cobranza_fondo_ahorro_usuario'
)
    CREATE UNIQUE INDEX UX_cobranza_fondo_ahorro_usuario
        ON cobranzas.cobranza_fondo_ahorro(id_root, id_usuario_cobrador);
GO

IF OBJECT_ID(N'cobranzas.cobranza_fondo_ahorro_movimientos', N'U') IS NULL
BEGIN
    CREATE TABLE cobranzas.cobranza_fondo_ahorro_movimientos
    (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_cobranza_fondo_ahorro_movimientos PRIMARY KEY,
        id_fondo BIGINT NOT NULL,
        tipo VARCHAR(12) NOT NULL,
        monto DECIMAL(18,2) NOT NULL,
        fecha_movimiento DATE NOT NULL,
        id_abono_cobranza INT NULL,
        comentario NVARCHAR(200) NULL,
        active BIT NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_mov_active DEFAULT (1),
        created_at_utc DATETIME2(3) NOT NULL CONSTRAINT DF_cobranza_fondo_ahorro_mov_created DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_cobranza_fondo_ahorro_mov_fondo
            FOREIGN KEY (id_fondo) REFERENCES cobranzas.cobranza_fondo_ahorro(id),
        CONSTRAINT CK_cobranza_fondo_ahorro_mov_tipo CHECK (tipo IN ('APORTE', 'RETIRO', 'APARTADO')),
        CONSTRAINT CK_cobranza_fondo_ahorro_mov_monto CHECK (monto > 0)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_fondo_ahorro_movimientos')
      AND name = N'IX_cobranza_fondo_ahorro_movimientos_fondo_fecha'
)
    CREATE INDEX IX_cobranza_fondo_ahorro_movimientos_fondo_fecha
        ON cobranzas.cobranza_fondo_ahorro_movimientos(id_fondo, fecha_movimiento DESC, id DESC)
        INCLUDE(tipo, monto, comentario, active);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_fondo_ahorro_movimientos')
      AND name = N'UX_cobranza_fondo_ahorro_mov_abono'
)
    CREATE UNIQUE INDEX UX_cobranza_fondo_ahorro_mov_abono
        ON cobranzas.cobranza_fondo_ahorro_movimientos(id_abono_cobranza)
        WHERE id_abono_cobranza IS NOT NULL;
GO

/* Novedad local de Angular: publicación del anuncio sin afirmar despliegue del código. */
IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.617'
      AND module = N'Cobranza / Configuración'
      AND idRoot IS NULL
      AND idCompany IS NULL
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.617', N'Cobranza / Configuración', N'IMPROVEMENT',
        N'Configuración de un consecutivo por empresa',
        N'La pantalla de Configuración de Cobranza muestra y edita un solo registro de consecutivo para la empresa seleccionada, con el prefijo, el siguiente número y una vista previa del folio. Se reemplazó la tabla por un formulario sencillo.',
        N'Simplifica la configuración del folio de cada empresa y evita administrar varias filas desde esta pantalla.',
        N'Configura el prefijo y siguiente folio de cada empresa desde una sola pantalla.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'PUBLISHED',
        SYSUTCDATETIME(), N'Codex', SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;
GO

/*
Fecha: 2026-11-23
Módulo: Administración / Cobranza / Permisos del consecutivo
Origen: error SQL 229 al crear el consecutivo de una empresa.
Ejecutar en administration con una cuenta administradora de SQL Server.
*/
USE [administration];
GO

GRANT INSERT, UPDATE, DELETE
    ON OBJECT::[cobranzas].[consecutivos]
    TO [Microservicio];
GO

SELECT
    USER_NAME() AS usuario_actual,
    HAS_PERMS_BY_NAME(N'cobranzas.consecutivos', N'OBJECT', N'SELECT') AS puede_consultar,
    HAS_PERMS_BY_NAME(N'cobranzas.consecutivos', N'OBJECT', N'INSERT') AS puede_insertar,
    HAS_PERMS_BY_NAME(N'cobranzas.consecutivos', N'OBJECT', N'UPDATE') AS puede_actualizar,
    HAS_PERMS_BY_NAME(N'cobranzas.consecutivos', N'OBJECT', N'DELETE') AS puede_eliminar;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Permisos de escritura del microservicio
Origen: error 500 al crear préstamos; Microservicio no tiene INSERT/UPDATE en las tablas del esquema cobranzas.
Ejecutar en administration con una cuenta administradora de SQL Server.
Este permiso cubre las tablas actuales y futuras del esquema de Cobranza.
*/
USE [administration];
GO

GRANT SELECT, INSERT, UPDATE, DELETE
    ON SCHEMA::[cobranzas]
    TO [Microservicio];
GO

SELECT
    USER_NAME() AS usuario_actual,
    HAS_PERMS_BY_NAME(N'cobranzas.prestamos_cobranza', N'OBJECT', N'INSERT') AS puede_insertar_prestamo,
    HAS_PERMS_BY_NAME(N'cobranzas.cuotas_cobranza', N'OBJECT', N'INSERT') AS puede_insertar_cuotas,
    HAS_PERMS_BY_NAME(N'cobranzas.abonos_cobranza', N'OBJECT', N'INSERT') AS puede_insertar_abonos,
    HAS_PERMS_BY_NAME(N'cobranzas.prestamos_cobranza', N'OBJECT', N'UPDATE') AS puede_actualizar_prestamo;
GO

/*
Fecha: 2026-11-23
Módulo: Cobranza / Préstamos y estado de cuenta PDF
Repositorio: Smp25
Origen: Angular, src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas.component.ts
Publica los anuncios en producción sin afirmar que el código esté desplegado.
*/
USE [administration];
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.618'
      AND module = N'Cobranza / Préstamos'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.618', N'Cobranza / Préstamos', N'IMPROVEMENT',
        N'Consecutivo automático de préstamos',
        N'Al abrir Nuevo préstamo se genera la nota con el prefijo y el siguiente número configurados para la empresa. Si la caja está offline, se usa un folio provisional y al sincronizar se asigna el consecutivo oficial.',
        N'Evita capturar manualmente el folio y mantiene la captura de préstamos durante una interrupción de internet.',
        N'Registra préstamos con su consecutivo automático y continúa capturando sin conexión.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'PUBLISHED',
        SYSUTCDATETIME(), N'Codex', SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE version = N'5.00.619'
      AND module = N'Cobranza / Estado de cuenta por cliente'
      AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone, validationStatus,
        releaseStatus, publicationStatus, publishedAtUtc, createdBy,
        createdAtUtc, updatedAtUtc, isActive
    )
    VALUES (
        NULL, NULL, N'5.00.619', N'Cobranza / Estado de cuenta por cliente', N'IMPROVEMENT',
        N'Estado de cuenta PDF por cliente',
        N'El reporte PDF del cliente incluye cuántos préstamos tiene, total programado, abonado, saldo pendiente y cuotas vencidas. Conserva el detalle de las cuotas y los abonos y se comparte desde el visor por correo, WhatsApp o Telegram.',
        N'Permite revisar y compartir la situación de pago completa de un cliente desde un solo reporte.',
        N'Consulta cuánto debe cada cliente y comparte su estado de cuenta en PDF por correo, WhatsApp o Telegram.',
        SYSUTCDATETIME(), N'America/Indiana/Indianapolis', N'PASSED', N'LOCAL', N'PUBLISHED',
        SYSUTCDATETIME(), N'Codex', SYSUTCDATETIME(), SYSUTCDATETIME(), 1
    );
END;
GO

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version IN (N'5.00.618', N'5.00.619')
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1
ORDER BY version, module;
GO

/* Despliegue confirmado por GitHub Actions: runs 45291527858 y 45291920708. */
UPDATE dbo.product_updates
SET releaseStatus = N'PRODUCTION', updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.618'
  AND module = N'Cobranza / Préstamos'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;

UPDATE dbo.product_updates
SET releaseStatus = N'PRODUCTION', updatedAtUtc = SYSUTCDATETIME()
WHERE version = N'5.00.619'
  AND module = N'Cobranza / Estado de cuenta por cliente'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
GO

/*
  Fecha: 2026-11-23
  Módulo: Cobranza / Corte de caja
  Repositorios: Smp25 (Angular) y MicroServicioAdministration (API)
  Origen: src/app/domains/Cobranza/pages/corte-caja-cobranza.component.ts
  Publicación del aviso; ejecutar únicamente este bloque.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @nowUtc datetime2 = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.624'
      AND module = N'Cobranza / Corte de caja'
      AND title = N'Intereses cobrados en el corte de caja'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.624', N'Cobranza / Corte de caja', 'IMPROVEMENT',
        N'Intereses cobrados en el corte de caja',
        N'El corte por rango de fechas separa los intereses efectivamente cobrados del capital recuperado. El desglose aparece por cobrador, movimiento y en el PDF; los abonos parciales distribuyen el interés proporcionalmente entre las cuotas del calendario.',
        N'Permite conocer cuánto del efectivo recibido corresponde a ganancias por intereses durante el período consultado.',
        N'Consulta los intereses que realmente cobraste en el período, separados del capital y por cobrador.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc,
        N'Codex', 1
    );
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.624'
  AND module = N'Cobranza / Corte de caja'
  AND title = N'Intereses cobrados en el corte de caja'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
COMMIT TRANSACTION;
GO

/*
  Fecha: 2026-11-23
  Módulo: Cobranza / Corte de caja
  Repositorios: Smp25 (Angular) y MicroServicioAdministration (API)
  Origen: src/app/domains/Cobranza/pages/corte-caja-cobranza.component.ts
  Publicación idempotente del reporte que incluye abonos de cortes ya guardados.
  Ejecutar únicamente este bloque.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @nowUtc625 datetime2 = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.625'
      AND module = N'Cobranza / Corte de caja'
      AND title = N'Reporte de ganancias incluye cortes guardados'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'5.00.625', N'Cobranza / Corte de caja', 'FIX',
        N'Reporte de ganancias incluye cortes guardados',
        N'Se agregó una sección y un PDF independientes de ganancias por intereses. El reporte consulta todos los abonos del rango, incluidos los que ya están en cortes guardados; el corte operativo conserva su filtro para no duplicar movimientos.',
        N'Permite consultar las ganancias de un período ya cerrado y verlas por cobrador, separadas del capital.',
        N'Consulta e imprime las ganancias por intereses de cualquier rango, aunque el corte ya esté guardado.',
        @nowUtc625, N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', @nowUtc625,
        N'Codex', 1
    );
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE version = N'5.00.625'
  AND module = N'Cobranza / Corte de caja'
  AND title = N'Reporte de ganancias incluye cortes guardados'
  AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1;
COMMIT TRANSACTION;
GO

/*
  SUNMI-COBRANZA-NOPAGO-628-MIGRATION-START
  Fecha: 2026-11-24
  Módulo: Cobranza / Telegram
  Repositorio: Smp25 (Angular); origen del fallo: ChatbotTelegram/chatBotTelegram/Services/Telegram/ConversationManagerService.Cobranza.cs
  Permitir visitas sin ubicación en la tabla existente; conservar los datos.
  Ejecutar únicamente este bloque en administration.
*/
IF OBJECT_ID(N'cobranzas.cobranza_visitas_nopago', N'U') IS NULL
    THROW 51028, N'Falta cobranzas.cobranza_visitas_nopago; ejecutar primero su bloque de creación.', 1;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_visitas_nopago') AND name = N'latitud' AND is_nullable = 0)
    ALTER TABLE cobranzas.cobranza_visitas_nopago ALTER COLUMN latitud DECIMAL(9,6) NULL;

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'cobranzas.cobranza_visitas_nopago') AND name = N'longitud' AND is_nullable = 0)
    ALTER TABLE cobranzas.cobranza_visitas_nopago ALTER COLUMN longitud DECIMAL(9,6) NULL;
-- SUNMI-COBRANZA-NOPAGO-628-MIGRATION-END
GO

/*
  SUNMI-COBRANZA-NOPAGO-628-UPDATE-START
  Fecha: 2026-11-24
  Módulo: Cobranza / Telegram
  Repositorio: Smp25 (Angular); origen: docs/registro-actualizaciones.md
  Publicación idempotente de esta corrección. Ejecutar únicamente este bloque.
*/
IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL AND module = N'Cobranza / Telegram'
      AND title = N'Visitas sin pago desde Telegram sin ubicación obligatoria' AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc, createdBy, isActive)
    VALUES
    (NULL, NULL, N'5.00.628', N'Cobranza / Telegram', 'FIX',
     N'Visitas sin pago desde Telegram sin ubicación obligatoria',
     N'Se corrigió el registro de visitas sin abono para que no exija la ubicación del teléfono.',
     N'El cobrador puede confirmar la visita sin pago desde Telegram.',
     N'Registra visitas sin pago desde Telegram, sin compartir tu ubicación.',
     SYSUTCDATETIME(), N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', SYSUTCDATETIME(), N'Codex', 1);
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL AND module = N'Cobranza / Telegram'
  AND title = N'Visitas sin pago desde Telegram sin ubicación obligatoria' AND isActive = 1;
-- SUNMI-COBRANZA-NOPAGO-628-UPDATE-END
GO

/*
  COBRANZA-DETALLE-TICKET-NOPAGO-629-UPDATE-START
  Fecha: 2026-11-24
  Módulo: Cobranza / Clientes y Telegram
  Repositorios: Smp25 (Angular) y ChatbotTelegram
  Origen: src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas-pagos.component.ts
          y chatBotTelegram/Services/Telegram/ConversationManagerService.Cobranza.cs
  Publicación idempotente; ejecutar únicamente este bloque en administration.
*/
IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Cobranza / Clientes y Telegram'
      AND title = N'Detalle de préstamos y ticket de visita sin abono'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc, createdBy, isActive)
    VALUES
    (NULL, NULL, N'5.00.629', N'Cobranza / Clientes y Telegram', 'FIX',
     N'Detalle de préstamos y ticket de visita sin abono',
     N'El detalle de los préstamos permanece abierto al consultar cuotas y registrar abonos. Telegram envía un ticket PDF cuando se confirma una visita sin pago.',
     N'La administradora puede entrar al detalle para cobrar y el cobrador recibe constancia de una visita sin abono.',
     N'Consulta el detalle para cobrar y entrega un comprobante cuando no hubo abono.',
     SYSUTCDATETIME(), N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', SYSUTCDATETIME(), N'Codex', 1);
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Cobranza / Clientes y Telegram'
  AND title = N'Detalle de préstamos y ticket de visita sin abono'
  AND isActive = 1;
-- COBRANZA-DETALLE-TICKET-NOPAGO-629-UPDATE-END
GO

/*
  COBRANZA-CARTERA-GENERAL-630-UPDATE-START
  Fecha: 2026-11-24
  Módulo: Cobranza / Cartera general PDF
  Repositorio: Smp25 (Angular)
  Origen: src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas.component.ts
  Publicación idempotente; ejecutar únicamente este bloque en administration.
*/
IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Cobranza / Cartera general PDF'
      AND title = N'Cartera general con intereses ganados y totales'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc, createdBy, isActive)
    VALUES
    (NULL, NULL, N'5.00.630', N'Cobranza / Cartera general PDF', 'IMPROVEMENT',
     N'Cartera general con intereses ganados y totales',
     N'El PDF de cartera general muestra los intereses cobrados por préstamo y suma los importes por cobrador y para toda la cartera.',
     N'La administradora puede revisar préstamos, cuotas fijas, saldos pendientes e intereses ganados en un solo reporte.',
     N'Consulta los intereses ganados y los totales de tu cartera general en el PDF.',
     SYSUTCDATETIME(), N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', SYSUTCDATETIME(), N'Codex', 1);
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Cobranza / Cartera general PDF'
  AND title = N'Cartera general con intereses ganados y totales'
  AND isActive = 1;
-- COBRANZA-CARTERA-GENERAL-630-UPDATE-END
GO

/*
  COBRANZA-TICKET-ABONO-FLOW-632-UPDATE-START
  Fecha: 2026-11-24
  Módulo: Cobranza / Ticket de abono
  Repositorio: Smp25 (Angular)
  Origen: src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas-pagos.component.ts
  Publicación idempotente; ejecutar únicamente este bloque en administration.
*/
IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Cobranza / Ticket de abono'
      AND title = N'Flujo de impresión después de guardar abono'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (idRoot, idCompany, version, module, changeType, title, description,
     userBenefit, promoText, occurredAtUtc, displayTimeZone,
     validationStatus, releaseStatus, publicationStatus, publishedAtUtc, createdBy, isActive)
    VALUES
    (NULL, NULL, N'5.00.632', N'Cobranza / Ticket de abono', 'FIX',
     N'Flujo de impresión después de guardar abono',
     N'El ticket se solicita antes de cerrar el formulario y actualizar los préstamos; el botón deja de indicar que guarda una vez confirmado el abono.',
     N'El flujo mantiene disponible el comprobante mientras actualiza los saldos.',
     N'Guarda el abono y continúa con su comprobante de pago.',
     SYSUTCDATETIME(), N'America/Indiana/Indianapolis', 'PASSED', 'LOCAL', 'PUBLISHED', SYSUTCDATETIME(), N'Codex', 1);
END;

SELECT id, version, module, title, validationStatus, releaseStatus, publicationStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND module = N'Cobranza / Ticket de abono'
  AND title = N'Flujo de impresión después de guardar abono'
  AND isActive = 1;
-- COBRANZA-TICKET-ABONO-FLOW-632-UPDATE-END
GO

-- 2026-11-25 | Cobranza / Abonos | Repositorio: Smp25
-- Origen: src/app/services/pos-ticket.service.ts
-- Ejecutar solamente este bloque. Anuncio publicado; código LOCAL, sin evidencia de despliegue.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM administration.dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
 WHERE module = N'Cobranza / Abonos' AND title = N'Corrección del comprobante PDF de abonos'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive = 1)
BEGIN
 INSERT INTO administration.dbo.product_updates
 (idRoot, idCompany, version, module, changeType, title, description, userBenefit, promoText,
 occurredAtUtc, displayTimeZone, validationStatus, releaseStatus, publicationStatus, publishedAtUtc, createdBy, isActive)
 VALUES (NULL, NULL, N'5.00.633', N'Cobranza / Abonos', 'FIX', N'Corrección del comprobante PDF de abonos',
 N'Se corrige la carga de fuentes del comprobante PDF que se genera después de guardar un abono.',
 N'Permite preparar el comprobante con las fuentes incluidas en la aplicación.',
 N'Consulta el comprobante PDF después de registrar tu abono.',
 SYSUTCDATETIME(), N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', SYSUTCDATETIME(), N'Codex', 1);
END;
UPDATE administration.dbo.product_updates SET version=N'5.00.633', updatedAtUtc=SYSUTCDATETIME() WHERE module=N'Cobranza / Abonos' AND title=N'Corrección del comprobante PDF de abonos' AND idRoot IS NULL AND idCompany IS NULL AND isActive=1 AND releaseStatus='LOCAL';
SELECT id, version, validationStatus, releaseStatus, publicationStatus FROM administration.dbo.product_updates
 WHERE module=N'Cobranza / Abonos' AND title=N'Corrección del comprobante PDF de abonos'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
COMMIT TRANSACTION;
GO

-- 2026-11-25 | Cobranza / Préstamos | Repositorio: Smp25
-- Origen: src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas-pagos.component.ts
-- Ejecutar solo este bloque: anuncio de la entrega, sin afirmar despliegue del código.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM administration.dbo.product_updates WITH (UPDLOCK,HOLDLOCK)
 WHERE module=N'Cobranza / Préstamos' AND title=N'Préstamos y cuotas con captura en modales'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1)
BEGIN
 INSERT INTO administration.dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.634',N'Cobranza / Préstamos','IMPROVEMENT',N'Préstamos y cuotas con captura en modales',
 N'Al abrir Pago se muestran los préstamos con sus cuotas anidadas. Incluye filtros Todos, Con saldo, Con atraso y Liquidados, cuotas desplegadas por defecto y modales para crear préstamos y consultar o registrar abonos. Conserva el estado de las filas durante la actualización.',
 N'Facilita consultar varios préstamos de un cliente y registrar pagos sin perder el contexto del calendario.',
 N'Consulta tus préstamos y cuotas en una sola vista; agrega préstamos y abonos desde ventanas de captura.',
 SYSUTCDATETIME(),N'America/Indiana/Indianapolis','PASSED','LOCAL','PUBLISHED',SYSUTCDATETIME(),N'Codex',1);
END;
SELECT id,version,validationStatus,releaseStatus,publicationStatus FROM administration.dbo.product_updates
 WHERE module=N'Cobranza / Préstamos' AND title=N'Préstamos y cuotas con captura en modales'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
COMMIT TRANSACTION;
GO

-- 2026-11-25 | Cobranza / Dashboard de clientes | Repositorio: Smp25
-- Origen: src/app/domains/Cobranza/components/clientes-cobranzas/clientes-cobranzas.component.ts
-- Ejecutar únicamente este bloque. Anuncio publicado; código LOCAL hasta verificar despliegue.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM administration.dbo.product_updates WITH (UPDLOCK,HOLDLOCK)
 WHERE module=N'Cobranza / Dashboard de clientes' AND title=N'Ganancias netas por cliente'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1)
BEGIN
 INSERT INTO administration.dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.635',N'Cobranza / Dashboard de clientes','IMPROVEMENT',N'Ganancias netas por cliente',
 N'El dashboard de Clientes incorpora una columna de ganancias netas calculada a partir de los intereses ganados en los abonos registrados.',
 N'Permite consultar por cliente el interés efectivamente ganado junto con los saldos y pagos.',
 N'Consulta las ganancias por intereses de cada cliente desde el dashboard de Cobranza.',
 SYSUTCDATETIME(),N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',SYSUTCDATETIME(),N'Codex',1);
END;
SELECT id,version,validationStatus,releaseStatus,publicationStatus FROM administration.dbo.product_updates
 WHERE module=N'Cobranza / Dashboard de clientes' AND title=N'Ganancias netas por cliente'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
COMMIT TRANSACTION;
GO

-- 2026-11-25 | Cobranza / Dashboard | Repositorio: Smp25
-- Origen: src/app/domains/Cobranza/pages/cobranza-dashboard.component.ts
-- Ejecutar solo este bloque: anuncio publicado; el código conserva releaseStatus LOCAL.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM administration.dbo.product_updates WITH (UPDLOCK,HOLDLOCK)
 WHERE module=N'Cobranza / Dashboard' AND title=N'Ganancias netas en el dashboard de Cobranza'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1)
BEGIN
 INSERT INTO administration.dbo.product_updates
 (idRoot,idCompany,version,module,changeType,title,description,userBenefit,promoText,occurredAtUtc,displayTimeZone,validationStatus,releaseStatus,publicationStatus,publishedAtUtc,createdBy,isActive)
 VALUES (NULL,NULL,N'5.00.636',N'Cobranza / Dashboard','IMPROVEMENT',N'Ganancias netas en el dashboard de Cobranza',
 N'El Centro de Cobranza muestra una tarjeta con las ganancias netas acumuladas, calculadas a partir de los intereses ganados en los abonos de cuotas activas.',
 N'Permite consultar rápidamente los intereses ganados de toda la cartera.',
 N'Consulta las ganancias netas por intereses directamente en el Centro de Cobranza.',
 SYSUTCDATETIME(),N'America/Indiana/Indianapolis','PENDING','LOCAL','PUBLISHED',SYSUTCDATETIME(),N'Codex',1);
END;
SELECT id,version,validationStatus,releaseStatus,publicationStatus FROM administration.dbo.product_updates
 WHERE module=N'Cobranza / Dashboard' AND title=N'Ganancias netas en el dashboard de Cobranza'
 AND idRoot IS NULL AND idCompany IS NULL AND isActive=1;
COMMIT TRANSACTION;
GO
