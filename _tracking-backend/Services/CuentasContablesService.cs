using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class CuentasContablesService : ICuentasContablesService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<CuentasContablesService> _logger;

        public CuentasContablesService(DbTrackingContext dbContext, ILogger<CuentasContablesService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<CuentasContables>> GetAll(int idCompany)
        {
            try
            {
                return await _context.CuentasContables
                    .Where(c => c.IdCompany == idCompany && c.Active)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all CuentasContables for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<List<CuentasContables>> GetByNivel(int idCompany, int nivel)
        {
            try
            {
                return await _context.CuentasContables
                    .Where(c => c.IdCompany == idCompany && c.Active && c.Nivel == nivel)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CuentasContables by nivel {Nivel} for company {IdCompany}", nivel, idCompany);
                throw;
            }
        }

        public async Task<List<CuentasContables>> GetHojas(int idCompany)
        {
            try
            {
                return await _context.CuentasContables
                    .Where(c => c.IdCompany == idCompany && c.Active && c.EsHoja)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Hojas CuentasContables for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<List<CuentasContablesHierarchyDto>> GetHierarchy(int idCompany)
        {
            try
            {
                var sql = @"
                WITH CuentasTree AS (
                    -- Nivel 1
                    SELECT
                        id,
                        codigo,
                        nombre,
                        descripcion,
                        nivel,
                        idPadre,
                        esHoja,
                        active,
                        idCompany,
                        CAST(codigo AS VARCHAR(255)) AS path,
                        CAST(nombre AS VARCHAR(255)) AS fullName,
                        CAST(codigo AS VARCHAR(255)) AS sortPath
                    FROM cuentascontables
                    WHERE nivel = 1 AND idCompany = @IdCompany AND active = 1

                    UNION ALL

                    -- Niveles 2 y 3
                    SELECT
                        c.id,
                        c.codigo,
                        c.nombre,
                        c.descripcion,
                        c.nivel,
                        c.idPadre,
                        c.esHoja,
                        c.active,
                        c.idCompany,
                        CAST(ct.path + ' > ' + c.codigo AS VARCHAR(255)),
                        CAST(ct.fullName + ' > ' + c.nombre AS VARCHAR(255)),
                        CAST(ct.sortPath + '.' + c.codigo AS VARCHAR(255))
                    FROM cuentascontables c
                    INNER JOIN CuentasTree ct ON c.idPadre = ct.id
                    WHERE c.active = 1
                )
                SELECT
                    id AS Id,
                    codigo AS Codigo,
                    nombre AS Nombre,
                    ISNULL(descripcion, '') AS Descripcion,
                    nivel AS Nivel,
                    idPadre AS IdPadre,
                    CAST(esHoja AS BIT) AS EsHoja,
                    CAST(active AS BIT) AS Active,
                    idCompany AS IdCompany,
                    fullName AS RutaCompleta,
                    sortPath AS SortPath,
                    0.0 AS MontoDirecto,
                    0.0 AS MontoAcumulado
                FROM CuentasTree
                ORDER BY sortPath";

                var parameter = new SqlParameter("@IdCompany", idCompany);

                return await _context.Set<CuentasContablesHierarchyDto>()
                    .FromSqlRaw(sql, parameter)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<List<CuentasContablesTreeDto>> GetTree(int idCompany)
        {
            try
            {
                var allCuentas = await _context.CuentasContables
                    .Where(c => c.IdCompany == idCompany && c.Active)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();

                // Construir árbol
                var cuentasDict = allCuentas.ToDictionary(c => c.Id);
                var tree = new List<CuentasContablesTreeDto>();

                foreach (var cuenta in allCuentas.Where(c => c.Nivel == 1))
                {
                    var nodo = MapToTreeDto(cuenta);
                    BuildTree(nodo, allCuentas, cuentasDict);
                    tree.Add(nodo);
                }

                return tree;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tree for company {IdCompany}", idCompany);
                throw;
            }
        }

        private CuentasContablesTreeDto MapToTreeDto(CuentasContables cuenta)
        {
            return new CuentasContablesTreeDto
            {
                Id = cuenta.Id,
                Codigo = cuenta.Codigo,
                Nombre = cuenta.Nombre,
                Descripcion = cuenta.Descripcion,
                Nivel = cuenta.Nivel,
                IdPadre = cuenta.IdPadre,
                EsHoja = cuenta.EsHoja,
                Active = cuenta.Active,
                Hijos = new List<CuentasContablesTreeDto>()
            };
        }

        private void BuildTree(CuentasContablesTreeDto padre, List<CuentasContables> todasLasCuentas, Dictionary<int, CuentasContables> dict)
        {
            var hijos = todasLasCuentas.Where(c => c.IdPadre == padre.Id).ToList();
            foreach (var hijo in hijos)
            {
                var nodoHijo = MapToTreeDto(hijo);
                BuildTree(nodoHijo, todasLasCuentas, dict);
                padre.Hijos.Add(nodoHijo);
            }
        }

        public async Task<List<CuentasContablesHierarchyDto>> GetHierarchyWithAmounts(int idCompany, DateTime? fechaInicio, DateTime? fechaFin)
        {
            try
            {
                var sql = @"
                WITH CuentasConMontos AS (
                    -- Nivel 3 (hojas) con sus montos
                    SELECT
                        c.id,
                        c.codigo,
                        c.nombre,
                        c.descripcion,
                        c.nivel,
                        c.idPadre,
                        c.esHoja,
                        c.active,
                        c.idCompany,
                        COALESCE(SUM(e.total), 0) AS montoDirecto,
                        COALESCE(SUM(e.total), 0) AS montoAcumulado
                    FROM cuentascontables c
                    LEFT JOIN incomeandexpense e ON c.id = e.id_cuenta_contable
                        AND e.active = 1
                        AND e.id_businnes = @IdCompany
                        AND (@FechaInicio IS NULL OR e.date >= @FechaInicio)
                        AND (@FechaFin IS NULL OR e.date <= @FechaFin)
                    WHERE c.esHoja = 1 AND c.idCompany = @IdCompany AND c.active = 1
                    GROUP BY c.id, c.codigo, c.nombre, c.descripcion, c.nivel, c.idPadre, c.esHoja, c.active, c.idCompany
                ),
                CuentasTree AS (
                    -- Nivel 1
                    SELECT
                        id,
                        codigo,
                        nombre,
                        descripcion,
                        nivel,
                        idPadre,
                        esHoja,
                        active,
                        idCompany,
                        CAST(codigo AS VARCHAR(255)) AS path,
                        CAST(nombre AS VARCHAR(255)) AS fullName,
                        CAST(codigo AS VARCHAR(255)) AS sortPath,
                        CAST(0.0 AS DECIMAL(18,2)) AS montoDirecto,
                        CAST(0.0 AS DECIMAL(18,2)) AS montoAcumulado
                    FROM cuentascontables
                    WHERE nivel = 1 AND idCompany = @IdCompany AND active = 1

                    UNION ALL

                    -- Niveles 2 y 3
                    SELECT
                        c.id,
                        c.codigo,
                        c.nombre,
                        c.descripcion,
                        c.nivel,
                        c.idPadre,
                        c.esHoja,
                        c.active,
                        c.idCompany,
                        CAST(ct.path + ' > ' + c.codigo AS VARCHAR(255)),
                        CAST(ct.fullName + ' > ' + c.nombre AS VARCHAR(255)),
                        CAST(ct.sortPath + '.' + c.codigo AS VARCHAR(255)),
                        ISNULL(cm.montoDirecto, 0.0),
                        ISNULL(cm.montoAcumulado, 0.0)
                    FROM cuentascontables c
                    INNER JOIN CuentasTree ct ON c.idPadre = ct.id
                    LEFT JOIN CuentasConMontos cm ON c.id = cm.id
                    WHERE c.active = 1
                )
                SELECT
                    id AS Id,
                    codigo AS Codigo,
                    nombre AS Nombre,
                    ISNULL(descripcion, '') AS Descripcion,
                    nivel AS Nivel,
                    idPadre AS IdPadre,
                    CAST(esHoja AS BIT) AS EsHoja,
                    CAST(active AS BIT) AS Active,
                    idCompany AS IdCompany,
                    fullName AS RutaCompleta,
                    sortPath AS SortPath,
                    montoDirecto AS MontoDirecto,
                    montoAcumulado AS MontoAcumulado
                FROM CuentasTree
                ORDER BY sortPath";

                var parameters = new[]
                {
                    new SqlParameter("@IdCompany", idCompany),
                    new SqlParameter("@FechaInicio", (object)fechaInicio ?? DBNull.Value),
                    new SqlParameter("@FechaFin", (object)fechaFin ?? DBNull.Value)
                };

                return await _context.Set<CuentasContablesHierarchyDto>()
                    .FromSqlRaw(sql, parameters)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy with amounts for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<CuentasContables?> GetById(int id)
        {
            try
            {
                return await _context.CuentasContables
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CuentaContable with ID {Id}", id);
                throw;
            }
        }

        public async Task<CuentasContables> Save(CuentasContables cuenta)
        {
            try
            {
                cuenta.CreatedAt = DateTime.Now;
                cuenta.UpdatedAt = DateTime.Now;

                _context.CuentasContables.Add(cuenta);
                await _context.SaveChangesAsync();

                return cuenta;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving CuentaContable");
                throw;
            }
        }

        public async Task<bool> Update(int id, CuentasContables cuenta)
        {
            try
            {
                var existingCuenta = await _context.CuentasContables.FindAsync(id);
                if (existingCuenta == null)
                {
                    return false;
                }

                existingCuenta.Codigo = cuenta.Codigo;
                existingCuenta.Nombre = cuenta.Nombre;
                existingCuenta.Descripcion = cuenta.Descripcion;
                existingCuenta.Nivel = cuenta.Nivel;
                existingCuenta.IdPadre = cuenta.IdPadre;
                existingCuenta.EsHoja = cuenta.EsHoja;
                existingCuenta.Active = cuenta.Active;
                existingCuenta.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating CuentaContable with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var cuenta = await _context.CuentasContables.FindAsync(id);
                if (cuenta == null)
                {
                    return false;
                }

                // Soft delete
                cuenta.Active = false;
                cuenta.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting CuentaContable with ID {Id}", id);
                throw;
            }
        }
    }

    public interface ICuentasContablesService
    {
        Task<List<CuentasContables>> GetAll(int idCompany);
        Task<List<CuentasContables>> GetByNivel(int idCompany, int nivel);
        Task<List<CuentasContables>> GetHojas(int idCompany);
        Task<List<CuentasContablesHierarchyDto>> GetHierarchy(int idCompany);
        Task<List<CuentasContablesTreeDto>> GetTree(int idCompany);
        Task<List<CuentasContablesHierarchyDto>> GetHierarchyWithAmounts(int idCompany, DateTime? fechaInicio, DateTime? fechaFin);
        Task<CuentasContables?> GetById(int id);
        Task<CuentasContables> Save(CuentasContables cuenta);
        Task<bool> Update(int id, CuentasContables cuenta);
        Task<bool> Delete(int id);
    }

}
