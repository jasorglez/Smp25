-- ============================================================
-- MODULO LOGISTICA - REMISIONES
-- Base de datos: administration
-- Fecha: 22 Abril 2026
-- ============================================================
--
-- OBJETIVO
-- 1. Crear remisiones por cliente
-- 2. Permitir parcialidades por detalle de pedido
-- 3. Permitir una sola remision ABIERTA por cliente y empresa
-- 4. Cerrar manualmente la remision para convertirla en ENTREGADO
--
-- SUPOSICIONES
-- - Ya existen las tablas dbo.Pedidos y dbo.DetallesPedidos
-- - dbo.DetallesPedidos.id es la PK del detalle
-- - dbo.Pedidos.id es la PK del pedido
-- - dbo.DetallesPedidos.idPedido apunta a dbo.Pedidos.id
-- - dbo.DetallesPedidos.idCliente existe y representa al cliente de la linea
--
-- NOTA
-- Este script crea las tablas nuevas. El cambio de estado a REMISION /
-- ENTREGADO y la logica de cierre se manejan desde API / frontend.
-- ============================================================

IF OBJECT_ID('dbo.vw_LogisticaRemisionesResumen', 'V') IS NOT NULL
  DROP VIEW dbo.vw_LogisticaRemisionesResumen;
GO

IF OBJECT_ID('dbo.RemisionesDetalle', 'U') IS NOT NULL
  DROP TABLE dbo.RemisionesDetalle;
GO

IF OBJECT_ID('dbo.Remisiones', 'U') IS NOT NULL
  DROP TABLE dbo.Remisiones;
GO

CREATE TABLE dbo.Remisiones (
  id                INT IDENTITY(1,1) PRIMARY KEY,
  idCompany         INT            NOT NULL,
  idCliente         INT            NOT NULL,
  folio             NVARCHAR(30)   NOT NULL,
  fechaCreacion     DATETIME       NOT NULL DEFAULT GETDATE(),
  fechaCierre       DATETIME       NULL,
  estado            NVARCHAR(20)   NOT NULL DEFAULT 'ABIERTA'
                      CHECK (estado IN ('ABIERTA', 'CERRADA')),
  comentario        NVARCHAR(500)  NULL,
  createdBy         NVARCHAR(150)  NULL,
  closedBy          NVARCHAR(150)  NULL,
  active            BIT            NOT NULL DEFAULT 1
);
GO

CREATE UNIQUE INDEX UX_Remisiones_Folio
  ON dbo.Remisiones (idCompany, folio)
  WHERE active = 1;
GO

CREATE UNIQUE INDEX UX_Remisiones_AbiertaPorCliente
  ON dbo.Remisiones (idCompany, idCliente)
  WHERE estado = 'ABIERTA' AND active = 1;
GO

CREATE INDEX IX_Remisiones_ClienteEstado
  ON dbo.Remisiones (idCompany, idCliente, estado, fechaCreacion DESC);
GO

CREATE TABLE dbo.RemisionesDetalle (
  id                    INT IDENTITY(1,1) PRIMARY KEY,
  idRemision            INT             NOT NULL,
  idDetallePedido       INT             NOT NULL,
  cantidadRemitida      DECIMAL(18,2)   NOT NULL,
  comentario            NVARCHAR(500)   NULL,
  fechaCreacion         DATETIME        NOT NULL DEFAULT GETDATE(),
  active                BIT             NOT NULL DEFAULT 1,

  CONSTRAINT FK_RemisionesDetalle_Remision
    FOREIGN KEY (idRemision) REFERENCES dbo.Remisiones(id),

  CONSTRAINT FK_RemisionesDetalle_DetallePedido
    FOREIGN KEY (idDetallePedido) REFERENCES dbo.DetallesPedidos(id),

  CONSTRAINT CK_RemisionesDetalle_CantidadPositiva
    CHECK (cantidadRemitida > 0)
);
GO

-- Una linea del pedido no debe repetirse dos veces dentro de la misma remision.
-- Si el usuario vuelve a agregarla, la API deberia actualizar la cantidad existente.
CREATE UNIQUE INDEX UX_RemisionesDetalle_RemisionDetalle
  ON dbo.RemisionesDetalle (idRemision, idDetallePedido)
  WHERE active = 1;
GO

CREATE INDEX IX_RemisionesDetalle_DetallePedido
  ON dbo.RemisionesDetalle (idDetallePedido, active);
GO

CREATE INDEX IX_RemisionesDetalle_Remision
  ON dbo.RemisionesDetalle (idRemision, active);
GO

-- ============================================================
-- VISTA RESUMEN
-- Maestro natural por remision para front / reportes
-- ============================================================
CREATE VIEW dbo.vw_LogisticaRemisionesResumen
AS
SELECT
  r.id,
  r.idCompany,
  r.idCliente,
  r.folio,
  r.fechaCreacion,
  r.fechaCierre,
  r.estado,
  r.comentario,
  r.createdBy,
  r.closedBy,
  r.active,
  DATEDIFF(DAY, CAST(r.fechaCreacion AS DATE), CAST(ISNULL(r.fechaCierre, GETDATE()) AS DATE)) AS diasTranscurridos,
  COUNT(rd.id) AS totalRenglones,
  SUM(ISNULL(rd.cantidadRemitida, 0)) AS totalCantidadRemitida,
  SUM(
    ISNULL(rd.cantidadRemitida, 0) * ISNULL(dp.venta, 0) + ISNULL(dp.impuesto, 0)
  ) AS totalImporte
FROM dbo.Remisiones r
LEFT JOIN dbo.RemisionesDetalle rd
  ON rd.idRemision = r.id
 AND rd.active = 1
LEFT JOIN dbo.DetallesPedidos dp
  ON dp.id = rd.idDetallePedido
GROUP BY
  r.id,
  r.idCompany,
  r.idCliente,
  r.folio,
  r.fechaCreacion,
  r.fechaCierre,
  r.estado,
  r.comentario,
  r.createdBy,
  r.closedBy,
  r.active;
GO

-- ============================================================
-- CONSULTAS UTILES
-- ============================================================

-- 1. Remisiones abiertas por cliente
-- SELECT * FROM dbo.vw_LogisticaRemisionesResumen
-- WHERE idCompany = 1 AND idCliente = 123 AND estado = 'ABIERTA' AND active = 1;

-- 2. Detalle completo de una remision
-- SELECT
--   r.folio,
--   r.estado,
--   r.fechaCreacion,
--   rd.id,
--   rd.cantidadRemitida,
--   dp.id AS idDetallePedido,
--   dp.idPedido,
--   dp.idCliente,
--   dp.producto,
--   dp.plataforma,
--   dp.cantidad AS cantidadOriginal,
--   dp.venta,
--   dp.impuesto,
--   dp.estado AS estadoDetalle
-- FROM dbo.Remisiones r
-- INNER JOIN dbo.RemisionesDetalle rd
--   ON rd.idRemision = r.id AND rd.active = 1
-- INNER JOIN dbo.DetallesPedidos dp
--   ON dp.id = rd.idDetallePedido
-- WHERE r.id = 1;

-- 3. Saldo pendiente por detalle del pedido
-- SELECT
--   dp.id AS idDetallePedido,
--   dp.idPedido,
--   dp.idCliente,
--   dp.producto,
--   dp.cantidad AS cantidadOriginal,
--   ISNULL(SUM(CASE WHEN r.active = 1 THEN rd.cantidadRemitida ELSE 0 END), 0) AS cantidadRemitida,
--   dp.cantidad - ISNULL(SUM(CASE WHEN r.active = 1 THEN rd.cantidadRemitida ELSE 0 END), 0) AS cantidadPendiente
-- FROM dbo.DetallesPedidos dp
-- LEFT JOIN dbo.RemisionesDetalle rd
--   ON rd.idDetallePedido = dp.id
--  AND rd.active = 1
-- LEFT JOIN dbo.Remisiones r
--   ON r.id = rd.idRemision
-- WHERE dp.idPedido = 1
-- GROUP BY dp.id, dp.idPedido, dp.idCliente, dp.producto, dp.cantidad;

-- ============================================================
-- RECOMENDACION DE LOGICA EN API
-- ============================================================
-- Crear remision:
--   1. Buscar si ya existe ABIERTA para idCompany + idCliente
--   2. Si existe, reutilizarla
--   3. Si no existe, crearla con un folio nuevo
--
-- Agregar detalle a remision:
--   1. Validar que la cantidadRemitida <= saldo pendiente del detalle
--   2. Insertar o actualizar RemisionesDetalle
--   3. Cambiar estado del detalle a 'REMISION' si aun tiene saldo en proceso
--
-- Cerrar remision:
--   1. Validar que tenga al menos un detalle activo
--   2. Marcar Remisiones.estado = 'CERRADA'
--   3. Asignar fechaCierre
--   4. Cambiar a 'ENTREGADO' los DetallesPedidos involucrados
--      solo cuando la cantidad remitida acumulada haya consumido la cantidad total
-- ============================================================
