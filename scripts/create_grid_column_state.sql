-- ============================================================================
-- Delison.grid_column_state
-- Persistencia POR USUARIO del estado de columnas de cualquier AG Grid
-- (visibilidad + orden + ancho). Clave lógica = (id_user, grid_key).
-- BD: warehouses  (schema Delison)
-- Backend: GridColumnStateDelison / GridColumnStateController / GridColumnStateService
-- Frontend: GridStatePersistenceService (genérico, por grid_key)
-- ============================================================================

USE [warehouses];
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.tables t
    INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE s.name = 'Delison' AND t.name = 'grid_column_state'
)
BEGIN
    CREATE TABLE [Delison].[grid_column_state] (
        [id]            INT IDENTITY(1,1) NOT NULL,
        [id_user]       INT               NOT NULL,
        [grid_key]      VARCHAR(100)      NOT NULL,
        [column_state]  NVARCHAR(MAX)     NULL,        -- JSON de gridApi.getColumnState()
        [datemodified]  DATETIME          NOT NULL CONSTRAINT [DF_grid_column_state_datemodified] DEFAULT (GETDATE()),
        CONSTRAINT [PK_grid_column_state] PRIMARY KEY CLUSTERED ([id] ASC),
        -- Un solo registro por (usuario, grid) → permite upsert
        CONSTRAINT [UQ_grid_column_state_user_key] UNIQUE ([id_user], [grid_key])
    );

    PRINT 'Tabla Delison.grid_column_state creada.';
END
ELSE
BEGIN
    PRINT 'Delison.grid_column_state ya existe — sin cambios.';
END
GO
