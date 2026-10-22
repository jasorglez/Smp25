USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL
      AND idCompany IS NULL
      AND module = N'Administración / Usuarios'
      AND title = N'Conserva el ancho de la columna Email'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'local', N'Administración / Usuarios', 'IMPROVEMENT',
        N'Conserva el ancho de la columna Email',
        N'La columna Email del grid principal de Usuarios inicia con más espacio y conserva en este navegador el ancho que el usuario elija al volver a abrir la pantalla.',
        N'Permite leer direcciones largas y mantener la vista preferida entre sesiones.',
        N'Ajusta la columna Email en Usuarios y conserva el ancho elegido al regresar.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM dbo.product_updates
    WHERE idRoot IS NULL
      AND idCompany IS NULL
      AND module = N'Almacenes / Requisiciones, OC, Entradas y Salidas'
      AND title = N'Confirma las asignaciones de autorización'
      AND isActive = 1
)
BEGIN
    INSERT INTO dbo.product_updates
    (
        idRoot, idCompany, version, module, changeType, title, description,
        userBenefit, promoText, occurredAtUtc, displayTimeZone,
        validationStatus, releaseStatus, publicationStatus, publishedAtUtc,
        createdBy, isActive
    )
    VALUES
    (
        NULL, NULL, N'local', N'Almacenes / Requisiciones, OC, Entradas y Salidas', 'FIX',
        N'Confirma las asignaciones de autorización',
        N'Al elegir un autorizador se muestra una confirmación que recuerda guardar. Al retirar la autorización, el campo queda vacío. El candado ya no selecciona la fila y el grid dejó de animar las filas al actualizarse.',
        N'Identifica quién quedó asignado, limpia al retirar la autorización y evita el movimiento del candado en el grid.',
        N'Asigna y retira autorizaciones con confirmación clara y sin movimiento en el grid.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;
GO
