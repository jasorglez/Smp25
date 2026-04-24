using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using System.Diagnostics.Contracts;


namespace SMP.Services
{
    public class CatalogService : ICatalogService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<CatalogService> _logger;

        public CatalogService(DbSmpContext dbContext, ILogger<CatalogService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Catalog>> GetTypeAll(int idCompany)
        {
            try
            {
                return await _context.Catalogs
                    .Where(c => c.Active == 1 && c.IdCompany == idCompany)
                    .Select(cat => new Catalog
                    {
                        Id = cat.Id,
                        IdCompany = cat.IdCompany,
                        Description = cat.Description,
                        ValueAddition = cat.ValueAddition,
                        ValueAddition2 = cat.ValueAddition2,
                        ValueAdditionBit = cat.ValueAdditionBit,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        SubParentId = cat.SubParentId,
                        Vigente = cat.Vigente,
                        Price = cat.Price,
                        Active = cat.Active

                    })
                    .OrderByDescending(cat => cat.Vigente)
                    .ThenBy(cat => cat.Description)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
                throw;
            }
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
                        ValueAdditionBit = cat.ValueAdditionBit,
                        Type = cat.Type,
                        ParentId = cat.ParentId,
                        SubParentId = cat.SubParentId,
                        Vigente = cat.Vigente,
                        Price = cat.Price,
                        Active = cat.Active

                    })
                    .OrderByDescending(cat => cat.Vigente)
                    .ThenBy(cat => cat.Description)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalogs");
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


        public async Task<Catalog> Update(int id, Catalog cat)
        {
            var existingCat = await _context.Catalogs.FindAsync(id);
            if (existingCat == null)
            {
                _logger.LogWarning("Attempted to update non-existent Catalog with ID {Id}", id);
                return null;
            }

            try
            {
                // Solo actualizar campos que tengan valores válidos (no nulos o vacíos)


                if (cat.ValueAdditionBit.HasValue)
                    existingCat.ValueAdditionBit = cat.ValueAdditionBit;

                if (cat.Vigente.HasValue)
                    existingCat.Vigente = cat.Vigente;

                if (cat.ParentId.HasValue)
                    existingCat.ParentId = cat.ParentId;

                if (cat.SubParentId.HasValue)
                    existingCat.SubParentId = cat.SubParentId;

                if (cat.Price.HasValue)
                    existingCat.Price = cat.Price;

                // Strings - verificar que no estén vacíos
                if (!string.IsNullOrWhiteSpace(cat.Description))
                    existingCat.Description = cat.Description;

                if (!string.IsNullOrWhiteSpace(cat.ValueAddition))
                    existingCat.ValueAddition = cat.ValueAddition;

                if (!string.IsNullOrWhiteSpace(cat.ValueAddition2))
                    existingCat.ValueAddition2 = cat.ValueAddition2;


                // Active - short no nullable, siempre actualizar
                // O puedes verificar: if (cat.Active != 0)
                existingCat.Active = cat.Active;

                await _context.SaveChangesAsync();
                return existingCat;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating catalog with ID {Id}.", id);
                return null;
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
        Task<List<Catalog>> GetTypeAll(int idCompany);

        Task Save(Catalog cat);
        Task<Catalog> Update(int id, Catalog cat);
        Task<bool> Delete(int id);
    }
}
