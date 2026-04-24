using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.Palacio;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class ObjetoGastoService : IObjetoGastoService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<ObjetoGastoService> _logger;

        public ObjetoGastoService(DbTrackingContext dbContext, ILogger<ObjetoGastoService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<ObjetoGasto>> GetAll(int idCompany)
        {
            try
            {
                return await _context.ObjetoGasto
                    .Where(c => c.IdCompany == idCompany && c.Active)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all ObjetoGasto for company {IdCompany}", idCompany);
                throw;
            }
        }


        public async Task<IEnumerable<GastoPorNivelDTO>> GetGastosNivel(int idCompany)
        {
            try
            {
                // 1. Cargar toda la jerarquía de ObjetoGasto en memoria
                var objetosGasto = await _context.ObjetoGasto
                    .Where(o => o.IdCompany == idCompany && o.Active)
                    .Select(o => new { o.Id, o.Codigo, o.Nombre, o.Nivel, o.IdPadre })
                    .ToListAsync();

                var objetosDict = objetosGasto.ToDictionary(o => o.Id);

                // 2. Obtener los gastos con nivel 4
                var gastosNivel4 = await (
                    from c in _context.ConceptsxIncorExps
                    where c.Active
                    join i in _context.Incomeandexpenses on c.IdIncorExp equals i.Id
                    where i.Facturado == true && i.IdBusinnes == idCompany
                    join o in _context.ObjetoGasto on c.IdCatIng equals o.Id
                    where o.Nivel == 4
                    select new
                    {
                        IdNivel4 = o.Id,
                        CodigoNivel4 = o.Codigo,
                        NombreNivel4 = o.Nombre,
                        IdPadreNivel4 = o.IdPadre,
                        Total = c.Total
                    }
                ).ToListAsync();

                // 3. Procesar en memoria: encontrar el nivel 1 de cada registro
                var resultado = gastosNivel4
                    .Select(g =>
                    {
                        // Navegar hacia arriba hasta encontrar nivel 1
                        var nivel1Codigo = "N/A";
                        var nivel1Nombre = "No Categorizado";

                        if (g.IdPadreNivel4.HasValue)
                        {
                            var actualId = g.IdPadreNivel4.Value;

                            // Recorrer hacia arriba hasta llegar a nivel 1
                            while (objetosDict.ContainsKey(actualId))
                            {
                                var actual = objetosDict[actualId];

                                if (actual.Nivel == 1)
                                {
                                    nivel1Codigo = actual.Codigo;
                                    nivel1Nombre = actual.Nombre;
                                    break;
                                }

                                if (!actual.IdPadre.HasValue)
                                    break;

                                actualId = actual.IdPadre.Value;
                            }
                        }

                        return new
                        {
                            CodigoNivel1 = nivel1Codigo,
                            Nivel1 = nivel1Nombre,
                            g.CodigoNivel4,
                            NombreNivel4 = g.NombreNivel4,
                            g.Total
                        };
                    })
                    .GroupBy(x => new
                    {
                        x.CodigoNivel1,
                        x.Nivel1,
                        x.CodigoNivel4,
                        x.NombreNivel4
                    })
                    .Select(g => new GastoPorNivelDTO
                    {
                        CodigoNivel1 = g.Key.CodigoNivel1,
                        Nivel1 = g.Key.Nivel1,
                        CodigoNivel4 = g.Key.CodigoNivel4,
                        Nivel4 = g.Key.NombreNivel4,
                        CantidadConceptos = g.Count(),
                        TotalMonto = g.Sum(x => x.Total)
                    })
                    .OrderBy(x => x.CodigoNivel1)
                    .ThenBy(x => x.CodigoNivel4)
                    .ToList();

                return resultado;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener gastos por nivel para la compañía {IdCompany}", idCompany);
                throw;
            }
        }



        public async Task<List<ObjetoGasto>> GetByNivel(int idCompany, int nivel)
        {
            try
            {
                return await _context.ObjetoGasto
                    .Where(c => c.IdCompany == idCompany && c.Active && c.Nivel == nivel)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto by nivel {Nivel} for company {IdCompany}", nivel, idCompany);
                throw;
            }
        }

        public async Task<List<ObjetoGasto>> GetHojas(int idCompany)
        {
            try
            {
                return await _context.ObjetoGasto
                    .Where(c => c.IdCompany == idCompany && c.Active && c.EsHoja)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Hojas ObjetoGasto for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<List<ObjetoGastoHierarchyDto>> GetHierarchy(int idCompany)
        {
            try
            {
                var sql = @"
                WITH ObjetoGastoTree AS (
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
                        CAST(nombre AS VARCHAR(500)) AS fullName,
                        CAST(codigo AS VARCHAR(255)) AS sortPath
                    FROM objetogasto
                    WHERE nivel = 1 AND idCompany = @IdCompany AND active = 1

                    UNION ALL

                    -- Niveles 2, 3 y 4
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
                        CAST(ct.fullName + ' > ' + c.nombre AS VARCHAR(500)),
                        CAST(ct.sortPath + '.' + c.codigo AS VARCHAR(255))
                    FROM objetogasto c
                    INNER JOIN ObjetoGastoTree ct ON c.idPadre = ct.id
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
                FROM ObjetoGastoTree
                ORDER BY sortPath";

                var parameter = new SqlParameter("@IdCompany", idCompany);

                return await _context.Set<ObjetoGastoHierarchyDto>()
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

        public async Task<List<ObjetoGastoTreeDto>> GetTree(int idCompany)
        {
            try
            {
                var allObjetoGasto = await _context.ObjetoGasto
                    .Where(c => c.IdCompany == idCompany && c.Active)
                    .OrderBy(c => c.Codigo)
                    .AsNoTracking()
                    .ToListAsync();

                // Construir árbol
                var objetoGastoDict = allObjetoGasto.ToDictionary(c => c.Id);
                var tree = new List<ObjetoGastoTreeDto>();

                foreach (var objetoGasto in allObjetoGasto.Where(c => c.Nivel == 1))
                {
                    var nodo = MapToTreeDto(objetoGasto);
                    BuildTree(nodo, allObjetoGasto, objetoGastoDict);
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

        private ObjetoGastoTreeDto MapToTreeDto(ObjetoGasto objetoGasto)
        {
            return new ObjetoGastoTreeDto
            {
                Id = objetoGasto.Id,
                Codigo = objetoGasto.Codigo,
                Nombre = objetoGasto.Nombre,
                Descripcion = objetoGasto.Descripcion,
                Nivel = objetoGasto.Nivel,
                IdPadre = objetoGasto.IdPadre,
                EsHoja = objetoGasto.EsHoja,
                Active = objetoGasto.Active,
                Hijos = new List<ObjetoGastoTreeDto>()
            };
        }

        private void BuildTree(ObjetoGastoTreeDto padre, List<ObjetoGasto> todosLosObjetoGasto, Dictionary<int, ObjetoGasto> dict)
        {
            var hijos = todosLosObjetoGasto.Where(c => c.IdPadre == padre.Id).ToList();
            foreach (var hijo in hijos)
            {
                var nodoHijo = MapToTreeDto(hijo);
                BuildTree(nodoHijo, todosLosObjetoGasto, dict);
                padre.Hijos.Add(nodoHijo);
            }
        }

        public async Task<List<ObjetoGastoHierarchyDto>> GetHierarchyWithAmounts(int idCompany, DateTime? fechaInicio, DateTime? fechaFin)
        {
            try
            {
                var sql = @"
                WITH ObjetoGastoConMontos AS (
                    -- Nivel 4 (hojas) con sus montos
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
                    FROM objetogasto c
                    LEFT JOIN incomeandexpense e ON c.id = e.id_objeto_gasto
                        AND e.active = 1
                        AND e.id_businnes = @IdCompany
                        AND (@FechaInicio IS NULL OR e.date >= @FechaInicio)
                        AND (@FechaFin IS NULL OR e.date <= @FechaFin)
                    WHERE c.esHoja = 1 AND c.idCompany = @IdCompany AND c.active = 1
                    GROUP BY c.id, c.codigo, c.nombre, c.descripcion, c.nivel, c.idPadre, c.esHoja, c.active, c.idCompany
                ),
                ObjetoGastoTree AS (
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
                        CAST(nombre AS VARCHAR(500)) AS fullName,
                        CAST(codigo AS VARCHAR(255)) AS sortPath,
                        CAST(0.0 AS DECIMAL(18,2)) AS montoDirecto,
                        CAST(0.0 AS DECIMAL(18,2)) AS montoAcumulado
                    FROM objetogasto
                    WHERE nivel = 1 AND idCompany = @IdCompany AND active = 1

                    UNION ALL

                    -- Niveles 2, 3 y 4
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
                        CAST(ct.fullName + ' > ' + c.nombre AS VARCHAR(500)),
                        CAST(ct.sortPath + '.' + c.codigo AS VARCHAR(255)),
                        ISNULL(cm.montoDirecto, 0.0),
                        ISNULL(cm.montoAcumulado, 0.0)
                    FROM objetogasto c
                    INNER JOIN ObjetoGastoTree ct ON c.idPadre = ct.id
                    LEFT JOIN ObjetoGastoConMontos cm ON c.id = cm.id
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
                FROM ObjetoGastoTree
                ORDER BY sortPath";

                var parameters = new[]
                {
                    new SqlParameter("@IdCompany", idCompany),
                    new SqlParameter("@FechaInicio", (object)fechaInicio ?? DBNull.Value),
                    new SqlParameter("@FechaFin", (object)fechaFin ?? DBNull.Value)
                };

                return await _context.Set<ObjetoGastoHierarchyDto>()
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

        public async Task<ObjetoGasto?> GetById(int id)
        {
            try
            {
                return await _context.ObjetoGasto
                    .AsNoTracking()
                    .FirstOrDefaultAsync(c => c.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto with ID {Id}", id);
                throw;
            }
        }

        public async Task<ObjetoGasto> Save(ObjetoGasto objetoGasto)
        {
            try
            {
                objetoGasto.CreatedAt = DateTime.Now;
                objetoGasto.UpdatedAt = DateTime.Now;

                _context.ObjetoGasto.Add(objetoGasto);
                await _context.SaveChangesAsync();

                return objetoGasto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ObjetoGasto");
                throw;
            }
        }

        public async Task<bool> Update(int id, ObjetoGasto objetoGasto)
        {
            try
            {
                var existingObjetoGasto = await _context.ObjetoGasto.FindAsync(id);
                if (existingObjetoGasto == null)
                {
                    return false;
                }

                existingObjetoGasto.Codigo = objetoGasto.Codigo;
                existingObjetoGasto.Nombre = objetoGasto.Nombre;
                existingObjetoGasto.Descripcion = objetoGasto.Descripcion;
                existingObjetoGasto.Nivel = objetoGasto.Nivel;
                existingObjetoGasto.IdPadre = objetoGasto.IdPadre;
                existingObjetoGasto.EsHoja = objetoGasto.EsHoja;
                existingObjetoGasto.Active = objetoGasto.Active;
                existingObjetoGasto.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ObjetoGasto with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var objetoGasto = await _context.ObjetoGasto.FindAsync(id);
                if (objetoGasto == null)
                {
                    return false;
                }

                // Soft delete
                objetoGasto.Active = false;
                objetoGasto.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ObjetoGasto with ID {Id}", id);
                throw;
            }
        }


        public async Task<List<ObjetoGastoNivel4Dto>> GetNivel4PorCodigoNivel1(int idCompany, string codigoNivel1)
        {
            var query = from h4 in _context.ObjetoGasto
                        join h3 in _context.ObjetoGasto on h4.IdPadre equals h3.Id
                        join h2 in _context.ObjetoGasto on h3.IdPadre equals h2.Id
                        join h1 in _context.ObjetoGasto on h2.IdPadre equals h1.Id
                        where h4.Nivel == 4
                           && h4.Active
                           && h4.IdCompany == idCompany
                           && h1.Nivel == 1
                           && h1.Codigo == codigoNivel1  // Filtro por el código (1000, 2000, 3000...)
                           && h1.Active
                           && h2.Active
                           && h3.Active
                        orderby h4.Codigo
                        select new ObjetoGastoNivel4Dto
                        {
                            Id = h4.Id,  
                            CodigoNombre = h4.Codigo + " - " + h4.Nombre
                        };

            return await query.AsNoTracking().ToListAsync();
        }

    }


        public interface IObjetoGastoService
    {
        Task<List<ObjetoGasto>> GetAll(int idCompany);
        Task<IEnumerable<GastoPorNivelDTO>> GetGastosNivel(int idCompany);
        Task<List<ObjetoGasto>> GetByNivel(int idCompany, int nivel);
        Task<List<ObjetoGasto>> GetHojas(int idCompany);
        Task<List<ObjetoGastoHierarchyDto>> GetHierarchy(int idCompany);
        Task<List<ObjetoGastoTreeDto>> GetTree(int idCompany);
        Task<List<ObjetoGastoHierarchyDto>> GetHierarchyWithAmounts(int idCompany, DateTime? fechaInicio, DateTime? fechaFin);
        Task<ObjetoGasto?> GetById(int id);
        Task<ObjetoGasto> Save(ObjetoGasto objetoGasto);
        Task<bool> Update(int id, ObjetoGasto objetoGasto);
        Task<List<ObjetoGastoNivel4Dto>> GetNivel4PorCodigoNivel1(int idCompany, string codigoNivel1);
        Task<bool> Delete(int id);
    }

}
