-- ============================================================================
-- Condiciones de pago: Crédito (N días) y Anticipo (%) integradas a Gastos
-- Idempotente. Correr en pruebas (76.13.28.145) y producción (66.179.240.10).
-- BD: warehouses
-- ============================================================================

-- ── entradas_molienda (esquema Delison) ──────────────────────────────────────
-- credito: la entrada fue ingresada "a crédito" (material disponible, pago pendiente a N días)
IF COL_LENGTH('Delison.entradas_molienda', 'credito') IS NULL
    ALTER TABLE Delison.entradas_molienda
        ADD credito BIT NOT NULL CONSTRAINT DF_em_credito DEFAULT(0);
GO

-- anticipo_aplicado: monto del anticipo de la OC aplicado a ESTA entrada (FIFO o prorrateo)
IF COL_LENGTH('Delison.entradas_molienda', 'anticipo_aplicado') IS NULL
    ALTER TABLE Delison.entradas_molienda
        ADD anticipo_aplicado DECIMAL(16,2) NULL;
GO

-- ── ocandreq (esquema dbo) ───────────────────────────────────────────────────
-- anticipo_pagado: el dinero del anticipo de la OC ya se entregó/registró
IF COL_LENGTH('dbo.ocandreq', 'anticipo_pagado') IS NULL
    ALTER TABLE dbo.ocandreq
        ADD anticipo_pagado BIT NOT NULL CONSTRAINT DF_oc_anticipo_pagado DEFAULT(0);
GO

-- anticipo_monto: monto del anticipo registrado (= Total OC × cantidad% al marcar pagado)
IF COL_LENGTH('dbo.ocandreq', 'anticipo_monto') IS NULL
    ALTER TABLE dbo.ocandreq
        ADD anticipo_monto DECIMAL(16,2) NULL;
GO

-- fecha_anticipo: fecha en que se registró el pago del anticipo
IF COL_LENGTH('dbo.ocandreq', 'fecha_anticipo') IS NULL
    ALTER TABLE dbo.ocandreq
        ADD fecha_anticipo DATE NULL;
GO

-- metodo_anticipo: 'FIFO' | 'PRORRATEO' — se fija al aplicar el anticipo en la 1ª entrada
IF COL_LENGTH('dbo.ocandreq', 'metodo_anticipo') IS NULL
    ALTER TABLE dbo.ocandreq
        ADD metodo_anticipo VARCHAR(10) NULL;
GO

-- num_prorrateo: número de entregas entre las que se reparte el anticipo (solo PRORRATEO)
IF COL_LENGTH('dbo.ocandreq', 'num_prorrateo') IS NULL
    ALTER TABLE dbo.ocandreq
        ADD num_prorrateo INT NULL;
GO
