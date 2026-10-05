-- No subir a Git. Ejecutado en administration.
-- El valor "Subcontratista" tiene 14 caracteres; el campo anterior admitía 12.
ALTER TABLE dbo.customers
ALTER COLUMN type_int_or_ext nvarchar(30) NULL;
