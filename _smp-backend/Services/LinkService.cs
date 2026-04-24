using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class LinkService : ILinkService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger <ILinkService>_logger;

        public LinkService(DbSmpContext dbContext, ILogger<ILinkService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException (nameof(DbContext));
            _logger = logger ?? throw new ArgumentNullException (nameof(logger));
        }   

        public async Task<IEnumerable<Link>> Get()
        {
            try
            {
                return await _context.Links
                    .Where(l => l.Active ==1)
                    .AsNoTracking()
                    .ToListAsync();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error Retrieving Links");
                throw;
            }
        }

        public async Task<IEnumerable<Link>> GetxIdworkprogram(int id)
        {
            try
            {
                return await _context.Links
                    .Where(l => l.Active == 1 && l.IdWorkprogram==id)
                    .AsNoTracking()
                    .ToListAsync();

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error Retrieving Links");
                throw;
            }
        }

        public async Task Save(Link Li)
        {
            try
            {
                _context.Links.Add(Li);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Links");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Links");
                throw;
            }
        }

        public async Task<bool> Update(int id, Link Li)
        {
            var existing = await _context.Links.FindAsync(Li);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Links with ID {Id}", id);
                return false;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existing.IdWorkprogram = Li.IdWorkprogram;
                existing.Source        = Li.Source;
                existing.Target        = Li.Target;    
                existing.Type          = Li.Type;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Links with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Links with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Links.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Links With ID");
                return false;
            }
            try
            {
                existing.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Links with ID ", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while Delete Logic Links with ID ", id);
                throw;
            }
        }

    }

    public interface ILinkService
    {
        Task<IEnumerable<Link>> Get();
        Task<IEnumerable<Link>> GetxIdworkprogram(int id);
        Task Save(Link Li);
        Task<bool> Update(int id, Link Li);
        Task<bool> Delete(int id);
    }
}
