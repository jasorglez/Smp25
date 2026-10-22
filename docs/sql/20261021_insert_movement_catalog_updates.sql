USE administration;
GO

SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos, Entradas y Salidas'
      AND title = N'Configura el comportamiento de los movimientos'
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
        NULL, NULL, N'5.00.341', N'Almacenes / Catálogos, Entradas y Salidas', 'FEATURE',
        N'Configura el comportamiento de los movimientos',
        N'En Catálogos se asigna a cada tipo de movimiento un comportamiento: normal, traspaso, inicio de inventario o ajuste de inventario. El sistema usa el valor del catálogo para aplicar las reglas del movimiento; los registros anteriores mantienen compatibilidad mientras se clasifican.',
        N'Permite elegir cómo opera cada movimiento sin depender del texto de su descripción.',
        N'Configura desde Catálogos cómo se comportan tus movimientos de almacén.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Administración / Empresas y Almacenes'
      AND title = N'Crea movimientos iniciales para cada empresa nueva'
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
        NULL, NULL, N'5.00.342', N'Administración / Empresas y Almacenes', 'FEATURE',
        N'Crea movimientos iniciales para cada empresa nueva',
        N'Al dar de alta una empresa se crean cuatro tipos de Entrada: normal, traspaso, inicio de inventario y ajuste de inventario; además crea los tipos normal y traspaso para Salidas. Cada registro guarda su comportamiento en el catálogo de la empresa.',
        N'La empresa queda lista para capturar movimientos desde que se crea.',
        N'Cada empresa nueva recibe sus tipos iniciales de Entradas y Salidas.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND module = N'Almacenes / Catálogos, Entradas y Salidas'
      AND title = N'Usa el comportamiento configurado por empresa'
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
        NULL, NULL, N'5.00.343', N'Almacenes / Catálogos, Entradas y Salidas', 'FIX',
        N'Usa el comportamiento configurado por empresa',
        N'Las reglas de traspaso, inicio y ajuste de inventario ahora leen exclusivamente el comportamiento guardado en valueaddition. Los tipos sin valor configurado se procesan como normales.',
        N'Permite definir el comportamiento desde Catálogos sin depender del nombre del movimiento.',
        N'Define cómo opera cada movimiento con el comportamiento configurado por empresa.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND title IN (
      N'Configura el comportamiento de los movimientos',
      N'Crea movimientos iniciales para cada empresa nueva',
      N'Usa el comportamiento configurado por empresa'
  )
  AND isActive = 1
ORDER BY version;
GO
