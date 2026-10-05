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
