USE administration;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @nowUtc DATETIME2(0) = SYSUTCDATETIME();

IF NOT EXISTS (
    SELECT 1 FROM dbo.product_updates WITH (UPDLOCK, HOLDLOCK)
    WHERE idRoot IS NULL AND idCompany IS NULL
      AND version = N'5.00.471' AND isActive = 1
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
        NULL, NULL, N'5.00.471', N'Proyectos / Materiales', 'FIX',
        N'Protección al eliminar materiales con movimientos',
        N'Antes de eliminar un material se consultan las partidas de requisiciones, OC, entradas y salidas del proyecto o sucursal actual. Si hay referencias, el borrado se detiene y se indican los tipos encontrados. Si falla la consulta, también se detiene el borrado. La revisión cubre el contexto actual.',
        N'Evita eliminar materiales usados en documentos del proyecto y conserva el registro si no se pudo verificar su historial.',
        N'Protege tus materiales en Proyectos: consulta sus movimientos antes de eliminarlos.',
        @nowUtc, N'America/Indiana/Indianapolis', 'PENDING', 'LOCAL', 'PUBLISHED', @nowUtc,
        NULL, 1
    );
END;

COMMIT TRANSACTION;

SELECT id, version, title, publicationStatus, releaseStatus
FROM dbo.product_updates
WHERE idRoot IS NULL AND idCompany IS NULL
  AND version = N'5.00.471' AND isActive = 1;
