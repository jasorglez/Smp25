
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ProviderService : IProviderService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ProviderService> _logger;

        public ProviderService(DbSmpContext dbContext, ILogger<ProviderService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        }

        public async Task<List<Provider>> Get(int idRoot)
        {
            try
            {
                return await _context.Providers
                    .Where(c => c.Active == 1 && c.IdRoot == idRoot)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Providers for idRoot {IdRoot}", idRoot);
                throw;
            }
        }

        public async Task<List<object>> GetType(string type, int idRoot)
        {
            try
            {
                return await _context.Providers
                    .Where(c => c.Type==type && c.Active == 1 && c.IdRoot == idRoot)
                    .Select(n => new
                    {   n.Id, n.Name, n.Type, n.IdRoot
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Providers for type {Type} and idRoot {IdRoot}", type, idRoot);
                throw;
            }
        }



        public async Task Save(Provider comp)
        {
            try
            {
                _context.Providers.Add(comp);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Companys");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Companys");
                throw;
            }
        }


        public async Task<Provider?> Update(int id, Provider provider)
        {
            var existingProvider = await _context.Providers.FindAsync(id);
            if (existingProvider == null)
            {
                _logger.LogWarning("Attempted to update non-existent Provider with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingProvider.Name = provider.Name;
                existingProvider.Type = provider.Type;
                existingProvider.IdRoot = provider.IdRoot;
                existingProvider.NameShort = provider.NameShort;
                existingProvider.RFC = provider.RFC;
                existingProvider.Address = provider.Address;
                existingProvider.City = provider.City;
                existingProvider.Country = provider.Country;
                existingProvider.State = provider.State;
                existingProvider.Phone = provider.Phone;
                existingProvider.Consortium = provider.Consortium;
                existingProvider.Picture = provider.Picture;
                existingProvider.Email = provider.Email;
                existingProvider.Contact = provider.Contact;

                await _context.SaveChangesAsync();
                return existingProvider;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Provider with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Provider with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingPv = await _context.Providers.FindAsync(id);
            if (existingPv == null)
            {
                _logger.LogWarning("Attempted to update non-existent Providers With ID {Id}", id);
                return false;
            }
            try
            {
                existingPv.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Providers with ID ", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Providers with ID ", id);
                throw;
            }
        }
        
        public async Task<Provider?> GetById(int id)
        {
            try
            {
                return await _context.Providers
                    .Where(p => p.Id == id && p.Active == 1)
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Provider with ID {Id}", id);
                throw;
            }
        }


    }
    public interface IProviderService
    {
        Task<List<Provider>> Get(int idRoot);
        Task<List<object>> GetType(string type, int idRoot);
        Task Save(Provider comp);        
        Task<Provider?> Update(int id, Provider provider);
        Task<bool> Delete(int id);
        Task<Provider?> GetById(int id);

    }
}