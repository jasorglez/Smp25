use smp; 

select * from projects ORDER BY id desc ;


-- BEGIN COMPANY_PUBLICITY_IMAGE_WRITE_PERMISSIONS_689
-- Fecha: 2026-11-27 | Módulo: Publicidad | Repositorio: Smp25
-- Origen: HTTP 500 al subir imágenes; administration.publicidad.company_images existe,
-- pero el usuario SQL Microservicio tiene SELECT y no tiene INSERT ni UPDATE.
-- Ejecutar únicamente este bloque con una cuenta administradora de administration.
USE [administration];
GO
GRANT SELECT, INSERT, UPDATE
    ON OBJECT::[publicidad].[company_images]
    TO [Microservicio];
GO
IF EXISTS (
    SELECT required.permission_name
    FROM (VALUES (N'SELECT'), (N'INSERT'), (N'UPDATE')) AS required(permission_name)
    EXCEPT
    SELECT dp.permission_name
    FROM administration.sys.database_permissions dp
    JOIN administration.sys.database_principals p ON p.principal_id = dp.grantee_principal_id
    WHERE p.name = N'Microservicio'
      AND dp.class_desc = 'OBJECT_OR_COLUMN'
      AND dp.major_id = OBJECT_ID(N'administration.publicidad.company_images')
      AND dp.state_desc IN ('GRANT', 'GRANT_WITH_GRANT_OPTION')
)
    THROW 51000, 'No se aplicaron todos los permisos de escritura de publicidad para Microservicio.', 1;
SELECT p.name AS principal, dp.permission_name, dp.state_desc
FROM administration.sys.database_permissions dp
JOIN administration.sys.database_principals p ON p.principal_id = dp.grantee_principal_id
WHERE p.name = N'Microservicio'
  AND dp.class_desc = 'OBJECT_OR_COLUMN'
  AND dp.major_id = OBJECT_ID(N'administration.publicidad.company_images')
  AND dp.permission_name IN ('SELECT', 'INSERT', 'UPDATE')
ORDER BY dp.permission_name;
-- END COMPANY_PUBLICITY_IMAGE_WRITE_PERMISSIONS_689
GO
