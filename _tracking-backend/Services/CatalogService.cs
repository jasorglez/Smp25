using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class CatalogService : ICatalogService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<CatalogService> _logger;

        public CatalogService(DbTrackingContext dbContext, ILogger<CatalogService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Catalog>> GetType(string type, int idCompany)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.Type == type && c.IdCompany == idCompany)
                    .Select(cat => new Catalog
                    {
                        Id = cat.Id,
                        IdCompany = cat.IdCompany,
                        Description = cat.Description,
                        ValueAddition = cat.ValueAddition,
                        ValueAddition2 = cat.ValueAddition2,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        IdElection = cat.IdElection,
                        Nivel = cat.Nivel,
                        Active = cat.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
                throw;
            }
        }

        public async Task<List<Catalog>> GetParentId(int idroot, int idParent)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.IdCompany==idroot && 
                           c.ParentId == idParent && c.Type=="INCOME")
                    .Select(cat => new Catalog
                    {
                        Id = cat.Id,
                        IdCompany = cat.IdCompany,
                        Description = cat.Description,
                        ValueAddition = cat.ValueAddition,
                        ValueAddition2 = cat.ValueAddition2,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        IdElection = cat.IdElection,
                        Nivel = cat.Nivel,
                        Active = cat.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
                throw;
            }
        }

        public async Task<List<Catalog>> GetSubParentId(int idroot, int idSubParent)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.IdCompany == idroot &&
                           c.SubParentId == idSubParent && c.Type == "INCOME")
                    .Select(cat => new Catalog
                    {
                        Id = cat.Id,
                        IdCompany = cat.IdCompany,
                        Description = cat.Description,
                        ValueAddition = cat.ValueAddition,
                        ValueAddition2 = cat.ValueAddition2,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        IdElection = cat.IdElection,
                        Nivel = cat.Nivel,
                        Active = cat.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
                throw;
            }
        }

        public async Task<List<Catalog>> GetTypexNivel(string type, int idCompany, short nivel)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.Type == type && c.IdCompany == idCompany && c.Nivel==nivel)
                    .Select(cat => new Catalog
                    {
                        Id = cat.Id,
                        IdCompany = cat.IdCompany,
                        Description = cat.Description,
                        ValueAddition = cat.ValueAddition,
                        ValueAddition2 = cat.ValueAddition2,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        IdElection = cat.IdElection,
                        Nivel = cat.Nivel,
                        Active = cat.Active
                    })
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
                throw;
            }
        }

        public async Task<List<object>> GetFamilyCatalogs(int idCompany)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.Type == "family" && c.IdCompany == idCompany)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdCompany,
                        c.Description,
                        c.ParentId,
                        c.Type,
                        c.Nivel,
                        c.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving family catalogs");
                throw;
            }
        }

        public async Task<List<object>> GetSubfamilyCatalogs(int parentId)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.Type == "subfamily" && c.ParentId == parentId)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdCompany,
                        c.Description,
                        c.ParentId,
                        c.Type,
                        c.Nivel,
                        c.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving subfamily catalogs");
                throw;
            }
        }

        //aqui va la combinacion 
        public async Task<List<HierarchyCatalogDto>> GetHierarchy(int idCompany)
        {
            try
            {
                var sql = @"
                WITH hierarchy AS (
                    -- Nodos raíz (cuadrillas)
                    SELECT 
                        id,
                        id_company,
                        description,
                        valueaddition,
                        valueaddition2,
                        type,
                        parent_id,
                        election,
                        active,
                        0 as level,
                        CAST(RIGHT('000' + CAST(id AS VARCHAR(3)), 3) AS VARCHAR(MAX)) as sort_path
                    FROM administration.dbo.catalog 
                    WHERE parent_id = 0 AND id_company = @IdCompany AND active = 1 AND type IN ('CUADRILLA', 'PERSONAL')
                    
                    UNION ALL
                    
                    -- Nodos hijos (empleados)
                    SELECT 
                        t.id,
                        t.id_company,
                        t.description,
                        t.valueaddition,
                        t.valueaddition2,
                        t.type,
                        t.parent_id,
                        t.election,
                        t.active,
                        h.level + 1,
                        h.sort_path + '.' + RIGHT('000' + CAST(t.id AS VARCHAR(3)), 3)
                    FROM administration.dbo.catalog t
                    INNER JOIN hierarchy h ON t.parent_id = h.id
                    WHERE t.active = 1
                )
                SELECT 
                    CAST(id AS INT) AS Id,
                    CAST(id_company AS INT) AS IdCompany,
                    ISNULL(description, '') AS Description,
                    ISNULL(valueaddition, '') AS ValueAddition,
                    ISNULL(valueaddition2, '') AS ValueAddition2,
                    ISNULL(type, '') AS Type,
                    CAST(parent_id AS INT) AS ParentId,
                    CAST(ISNULL(election, 0) AS INT) AS IdElection,
                    CAST(active AS INT) AS Active,
                    CAST(level AS INT) AS Level,
                    sort_path AS SortPath,
                    CASE 
                        WHEN level = 0 THEN ISNULL(description, '')
                        ELSE '  └─ ' + ISNULL(description, '')
                    END AS DisplayHierarchy
                FROM hierarchy 
                ORDER BY sort_path";

                var result = await _context.Database
                    .SqlQueryRaw<HierarchyCatalogDto>(sql,
                        new Microsoft.Data.SqlClient.SqlParameter("@IdCompany", idCompany))
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy catalogs for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task Save(Catalog cat)
        {
            try
            {
                _context.Catalogs.Add(cat);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Catalogs");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Catalogs");
                throw;
            }
        }

        public async Task<bool> Update(int id, Catalog cat)
        {
            var existingConfig = await _context.Catalogs.FindAsync(id);
            if (existingConfig == null)
            {
                return false;
            }

            try
            {
                _context.Entry(existingConfig).CurrentValues.SetValues(cat);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating configuration with ID {Id}.", id);
                return false;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingCt = await _context.Catalogs.FindAsync(id);
            if (existingCt == null)
            {
                _logger.LogWarning("Attempted to update non-existent Catalogs With ID {Id}", id);
                return false;
            }
            try
            {
                existingCt.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Catalogs", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Catalog", id);
                throw;
            }
        }
             
    }

    public interface ICatalogService
    {
        Task<List<Catalog>> GetType(string type, int idCompany);
        Task<List<Catalog>> GetTypexNivel(string type, int idCompany, short nivel);
        Task<List<Catalog>> GetParentId(int idroot, int idParent);
        Task<List<Catalog>> GetSubParentId(int idroot, int idSubParent);
        Task<List<object>> GetFamilyCatalogs(int idCompany);
        Task<List<object>> GetSubfamilyCatalogs(int parentId);
        Task<List<HierarchyCatalogDto>> GetHierarchy(int idCompany);
        Task Save(Catalog cat);
        Task<bool> Update(int id, Catalog cat);
        Task<bool> Delete(int id);        
    }
}
