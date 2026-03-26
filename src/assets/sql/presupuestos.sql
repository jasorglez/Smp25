-- ============================================================
-- MÓDULO PRESUPUESTOS SIAF
-- Base de datos: administration (tracking microservicio)
-- Fecha: 25 Marzo 2026
-- ============================================================

-- 1. PRESUPUESTO — Encabezado / Header por versión
CREATE TABLE presupuesto (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  id_project          INT           NOT NULL,           -- FK a proyectos (smp DB)
  numrevision         INT           NOT NULL DEFAULT 0, -- 0=Rev.0, 1=Rev.1, ...
  nombre              NVARCHAR(50)  NOT NULL,            -- "Rev.0", "Rev.1" ...
  motivo              NVARCHAR(500) NULL,                -- "Presupuesto inicial", "Migración x→y"
  fecha_inicio        DATE          NULL,
  fecha_fin           DATE          NULL,
  vigente             BIT           NOT NULL DEFAULT 0,  -- Solo UNO true por proyecto
  usuario_responsable NVARCHAR(150) NULL,
  id_version_anterior INT           NULL REFERENCES presupuesto(id),
  idCompany           INT           NOT NULL,            -- idRoot/empresa
  fecha_creacion      DATETIME      NOT NULL DEFAULT GETDATE(),
  active              BIT           NOT NULL DEFAULT 1
);

-- Índice: solo puede haber un presupuesto vigente por proyecto
CREATE UNIQUE INDEX UX_presupuesto_vigente
  ON presupuesto (id_project, idCompany)
  WHERE vigente = 1 AND active = 1;

-- 2. PRESUPUESTO_LINEA — Detalle: una línea por cuenta/subcuenta
CREATE TABLE presupuesto_linea (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  id_presupuesto  INT             NOT NULL REFERENCES presupuesto(id),
  id_cuenta       INT             NOT NULL,              -- FK a cuentascontables
  descripcion     NVARCHAR(500)   NULL,
  monto           DECIMAL(18,2)   NOT NULL DEFAULT 0,
  active          BIT             NOT NULL DEFAULT 1
);

-- 3. PRESUPUESTO_MES — Distribución mensual por línea
CREATE TABLE presupuesto_mes (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  id_linea    INT           NOT NULL REFERENCES presupuesto_linea(id),
  mes         TINYINT       NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio        SMALLINT      NOT NULL,
  monto       DECIMAL(18,2) NOT NULL DEFAULT 0,
  active      BIT           NOT NULL DEFAULT 1,
  CONSTRAINT UX_presupuesto_mes UNIQUE (id_linea, mes, anio)
);

-- 4. PREREGISTRO_GASTO — Gasto comprometido antes de ejecutar (Req.3)
CREATE TABLE preregistro_gasto (
  id          INT IDENTITY(1,1) PRIMARY KEY,
  id_project  INT             NOT NULL,
  id_cuenta   INT             NOT NULL,                  -- FK a cuentascontables
  concepto    NVARCHAR(500)   NOT NULL,
  monto       DECIMAL(18,2)   NOT NULL DEFAULT 0,
  fecha       DATE            NOT NULL DEFAULT CAST(GETDATE() AS DATE),
  usuario     NVARCHAR(150)   NULL,
  idCompany   INT             NOT NULL,
  fecha_creacion DATETIME     NOT NULL DEFAULT GETDATE(),
  active      BIT             NOT NULL DEFAULT 1
);

-- 5. PRESUPUESTO_MIGRACION — Log de transferencias entre cuentas (Req.4)
CREATE TABLE presupuesto_migracion (
  id                    INT IDENTITY(1,1) PRIMARY KEY,
  id_presupuesto_nuevo  INT             NOT NULL REFERENCES presupuesto(id),
  id_cuenta_origen      INT             NOT NULL,
  id_cuenta_destino     INT             NOT NULL,
  monto_transferido     DECIMAL(18,2)   NOT NULL,
  motivo                NVARCHAR(500)   NULL,
  usuario               NVARCHAR(150)   NULL,
  fecha                 DATETIME        NOT NULL DEFAULT GETDATE(),
  active                BIT             NOT NULL DEFAULT 1
);

-- 6. PRESUPUESTO_INCREMENTO — Solicitudes de incremento (Req.6)
CREATE TABLE presupuesto_incremento (
  id                  INT IDENTITY(1,1) PRIMARY KEY,
  id_presupuesto      INT             NOT NULL REFERENCES presupuesto(id),
  id_cuenta           INT             NOT NULL,
  monto_solicitado    DECIMAL(18,2)   NOT NULL,
  motivo              NVARCHAR(500)   NULL,
  estado              NVARCHAR(20)    NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','autorizado','rechazado')),
  usuario_solicito    NVARCHAR(150)   NULL,
  usuario_autorizo    NVARCHAR(150)   NULL,
  fecha_solicitud     DATETIME        NOT NULL DEFAULT GETDATE(),
  fecha_autorizacion  DATETIME        NULL,
  active              BIT             NOT NULL DEFAULT 1
);

-- ============================================================
-- VISTA: saldo disponible por cuenta/proyecto (útil para Req.2, 3, 6)
-- saldo = presupuestado - preregistrado - ejecutado(expenditure)
-- ============================================================
-- NOTA: La parte de expenditure debe ajustarse según la estructura
--       real de la tabla expenditure en esta misma BD.
-- ============================================================
