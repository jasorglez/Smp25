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
