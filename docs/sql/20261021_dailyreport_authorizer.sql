-- Add the authorizer reference used to lock project daily reports.
USE smp;
GO

IF COL_LENGTH('dbo.dailyreport', 'id_authorize') IS NULL
BEGIN
    ALTER TABLE dbo.dailyreport ADD id_authorize INT NULL;
END;
GO
