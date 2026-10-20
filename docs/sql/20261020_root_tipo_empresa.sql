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
