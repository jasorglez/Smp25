-- ============================================================================
-- FASE 1 — Gastos Generales + estado de anticipo en OC
-- ----------------------------------------------------------------------------
-- Objetivo: permitir que los gastos NO-materiales (hoy: ANTICIPO; despues:
-- servicios, nomina, impuestos) aparezcan en la Captura de Gastos y cuadren
-- en el reporte diario.
--
-- Esta fase es 100% ADITIVA: crea una tabla nueva y una columna nueva.
-- NINGUN flujo actual lee todavia estas estructuras, por lo que el sistema
-- sigue funcionando exactamente igual tras ejecutarla.
--
-- Idempotente: se puede correr varias veces sin error.
-- BD: warehouses   |   Esquemas: Delison (tabla nueva) y dbo (ocandreq)
-- ============================================================================

-- 1) Tabla de gastos generales (fuente unica de gastos no-materiales) -----------
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = 'Delison' AND TABLE_NAME = 'gastos_generales'
)
BEGIN
    CREATE TABLE warehouses.Delison.gastos_generales (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        id_company      INT          NOT NULL,            -- empresa
        id_branch       INT          NOT NULL,            -- sucursal (para caer en la hoja correcta)
        id_departament  INT          NULL,                -- departamento
        id_oc           INT          NULL,                -- FK ocandreq (anticipo); NULL para nomina/servicios/impuestos
        tipo_gasto      VARCHAR(20)  NOT NULL,            -- 'ANTICIPO' | 'SERVICIO' | 'NOMINA' | 'IMPUESTO' ...
        folio           VARCHAR(255) NULL,                -- folio OC SIN '-E1' (anticipo); o folio propio
        concepto        VARCHAR(200) NULL,                -- "Anticipo 50% OC-BOD12-P2-GON1429"
        id_provider     INT          NULL,
        proveedor       VARCHAR(150) NULL,                -- nombre denormalizado (como en otras tablas)
        porcentaje      DECIMAL(7,2) NULL,                -- 50 (solo display/anticipo)
        monto           DECIMAL(18,2) NOT NULL,           -- VALOR del gasto (ej. anticipo 550.00)
        mas_iva         BIT          NOT NULL DEFAULT (0),
        estado          VARCHAR(15)  NOT NULL DEFAULT ('EN_TRAMITE'), -- 'EN_TRAMITE' | 'PAGADO'
        fecha_registro  DATE         NOT NULL,            -- clic "Registrar pago" en Nivel 3 (OC)
        fecha_pago      DATE         NULL,                -- clic "Pagar" en Captura (la que CUENTA para el reporte)
        nota_factura    VARCHAR(100) NULL,
        active          BIT          NOT NULL DEFAULT (1),
        datemodified    DATETIME     NOT NULL DEFAULT (GETDATE())
    );

    -- Indices de apoyo para los filtros de Captura / Reporte / Nivel 3.
    CREATE INDEX IX_gastos_generales_company_estado
        ON warehouses.Delison.gastos_generales (id_company, estado, active);
    CREATE INDEX IX_gastos_generales_id_oc
        ON warehouses.Delison.gastos_generales (id_oc);
END;
GO

-- 2) Estado del anticipo en la OC (espejo de ciclo de vida) ---------------------
-- NULL = sin anticipo registrado | 'EN_TRAMITE' = en cola en Captura | 'PAGADO' = ya pagado en Captura.
-- anticipo_pagado (BIT existente) se conserva: pasa a true SOLO cuando el estado llega a 'PAGADO',
-- para no romper la logica de saldo/neteo de anticipo que ya funciona.
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'ocandreq' AND COLUMN_NAME = 'anticipo_estado'
)
BEGIN
    ALTER TABLE warehouses.dbo.ocandreq
        ADD anticipo_estado VARCHAR(15) NULL;
END;
GO

-- 3) Verificacion (opcional) ---------------------------------------------------
-- SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='gastos_generales' AND TABLE_SCHEMA='Delison' ORDER BY ORDINAL_POSITION;
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='ocandreq' AND COLUMN_NAME='anticipo_estado';
