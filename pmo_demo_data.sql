-- ================================================================
-- PMO DEMO DATA — Solo UPDATEs, CERO borrado de registros
-- Proyecto 780: Carretera Cosamaloapan-Tuxtepec (id_contract=167)
-- BD: smp  |  Fecha: 29 Mayo 2026
-- ================================================================
-- PROPÓSITO: Activar predecesoras y avances para demo de Ruta Crítica
-- ================================================================

USE smp;
GO

-- ──────────────────────────────────────────────────────────────
-- ESCENARIO DEMO:
--   Tarea 1 (id=982): CONCRETO HIDRAULICO
--      → Atrasada: terminó May 15, hoy May 29, avance 65%
--   Tarea 2 (id=983): UNA PARTIDA ADICIONAL
--      → En Riesgo: depende de tarea 982, inicio May 20, fin Ago 30, avance 10%
--   Tarea 3 (id=984): TERECE CONCEPTOS
--      → Pendiente: depende de tarea 983, inicio Sep 1, fin Oct 31, sin avance
--   Tarea 4 (id=986): CONCEPTO 4 → HITO "Entrega Final"
--      → Hito al 30 Ago (misma fecha inicio y fin), depende de tarea 983
-- ──────────────────────────────────────────────────────────────

-- ── Tarea 1: CONCRETO HIDRAULICO — ATRASADA ───────────────────
UPDATE dbo.workprogram SET
  startdate   = '2026-03-05',
  endate      = '2026-05-15',   -- ya venció (hoy 29 May)
  progress    = 0.65,           -- 65% — sigue sin terminar = ATRASADA
  predecesor  = 0,              -- primera tarea, sin predecesora
  criticroute = 'Si'
WHERE id = 982;

-- ── Tarea 2: PARTIDA ADICIONAL — EN RIESGO ───────────────────
UPDATE dbo.workprogram SET
  startdate   = '2026-05-20',
  endate      = '2026-08-30',
  progress    = 0.10,           -- 10% avance
  predecesor  = 982,            -- depende de Tarea 1
  criticroute = 'Si'
WHERE id = 983;

-- ── Tarea 3: TERECE CONCEPTOS — PENDIENTE ─────────────────────
UPDATE dbo.workprogram SET
  startdate   = '2026-09-01',
  endate      = '2026-10-31',
  progress    = 0.00,
  predecesor  = 983,            -- depende de Tarea 2
  criticroute = 'No'
WHERE id = 984;

-- ── Tarea 4 → HITO "Entrega Final" ────────────────────────────
--   Duración = 0 días (hito) — misma fecha inicio y fin
UPDATE dbo.workprogram SET
  description = 'HITO — Entrega Final de Obra',
  activity    = 'H1',
  startdate   = '2026-08-30',
  endate      = '2026-08-30',   -- mismo día = HITO (duración 0)
  progress    = 0.00,
  predecesor  = 983,            -- depende de Tarea 2
  ponderado   = 0,
  costMX      = 0,
  -- total es columna COMPUTADA — no se puede modificar directamente
  criticroute = 'Si'
WHERE id = 986;

-- ── Curva S demo: 3 registros de avance semanal ───────────────
-- (Si ya hay registros del proyecto no se duplican — usa INSERT WHERE NOT EXISTS)
INSERT INTO dbo.advanced (id_contract, id_project, id_convenio, type, date, physicaladvanced, programadvanced, accumulateprogram, accumulatephysical, active)
SELECT 167, 780, 17, 'PROYECTO', '2026-05-01', 5.0, 7.0, 35.0, 30.0, 1
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.advanced WHERE id_project = 780 AND date = '2026-05-01'
);

INSERT INTO dbo.advanced (id_contract, id_project, id_convenio, type, date, physicaladvanced, programadvanced, accumulateprogram, accumulatephysical, active)
SELECT 167, 780, 17, 'PROYECTO', '2026-05-08', 6.5, 7.0, 42.0, 36.5, 1
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.advanced WHERE id_project = 780 AND date = '2026-05-08'
);

INSERT INTO dbo.advanced (id_contract, id_project, id_convenio, type, date, physicaladvanced, programadvanced, accumulateprogram, accumulatephysical, active)
SELECT 167, 780, 17, 'PROYECTO', '2026-05-15', 5.5, 7.0, 49.0, 42.0, 1
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.advanced WHERE id_project = 780 AND date = '2026-05-15'
);

INSERT INTO dbo.advanced (id_contract, id_project, id_convenio, type, date, physicaladvanced, programadvanced, accumulateprogram, accumulatephysical, active)
SELECT 167, 780, 17, 'PROYECTO', '2026-05-22', 5.0, 7.0, 56.0, 47.0, 1
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.advanced WHERE id_project = 780 AND date = '2026-05-22'
);

-- ── Verificar resultado ────────────────────────────────────────
SELECT id, activity, description, startdate, endate, progress,
       predecesor, criticroute, ponderado, total
FROM dbo.workprogram
WHERE id IN (982, 983, 984, 986)
ORDER BY id;

SELECT id, date, physicaladvanced, programadvanced, accumulateprogram, accumulatephysical
FROM dbo.advanced
WHERE id_project = 780
ORDER BY date;
GO
