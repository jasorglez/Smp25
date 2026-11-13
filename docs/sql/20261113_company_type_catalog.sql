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
