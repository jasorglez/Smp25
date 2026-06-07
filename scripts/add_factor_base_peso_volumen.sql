-- Agrega tipo (PESO/VOLUMEN) + factor_base (a kg o L) al catálogo peso_volumen y precarga factores.
-- Correr ANTES de actualizar el backend (v6.19).

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='peso_volumen' AND COLUMN_NAME='tipo')
BEGIN
    ALTER TABLE [warehouses].[Delison].[peso_volumen] ADD [tipo] VARCHAR(10) NULL;   -- 'PESO' | 'VOLUMEN'
    PRINT 'peso_volumen.tipo agregada.';
END
ELSE PRINT 'peso_volumen.tipo ya existe.';
GO

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
               WHERE TABLE_SCHEMA='Delison' AND TABLE_NAME='peso_volumen' AND COLUMN_NAME='factor_base')
BEGIN
    ALTER TABLE [warehouses].[Delison].[peso_volumen] ADD [factor_base] DECIMAL(18,8) NULL; -- cuánto vale en kg o L
    PRINT 'peso_volumen.factor_base agregada.';
END
ELSE PRINT 'peso_volumen.factor_base ya existe.';
GO

-- Precarga de factores (base: VOLUMEN→Litro, PESO→Kilogramo). Solo donde estén NULL.
UPDATE pv SET tipo='VOLUMEN', factor_base=0.001       FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='ml'  AND pv.factor_base IS NULL;
UPDATE pv SET tipo='VOLUMEN', factor_base=1           FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='l'   AND pv.factor_base IS NULL;
UPDATE pv SET tipo='VOLUMEN', factor_base=3.78541     FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='gal' AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=0.001       FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='g'   AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=1           FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='kg'  AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=0.000001    FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='mg'  AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=1000        FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='ton' AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=0.0283495   FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='oz'  AND pv.factor_base IS NULL;
UPDATE pv SET tipo='PESO',    factor_base=0.453592    FROM [warehouses].[Delison].[peso_volumen] pv WHERE pv.abreviatura='lb'  AND pv.factor_base IS NULL;
PRINT 'Factores de conversión precargados.';
