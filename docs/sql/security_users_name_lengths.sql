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
