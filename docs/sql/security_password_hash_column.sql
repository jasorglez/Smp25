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
