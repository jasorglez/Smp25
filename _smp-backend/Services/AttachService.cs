using Microsoft.EntityFrameworkCore;
using Microsoft.Identity.Client;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class AttachService : IAttachService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger <AttachService>_logger;

        public AttachService(DbSmpContext dbContext, ILogger<AttachService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Attach>> GetxId(int idTabla, string typDocto)
            {
                try
                {
                    return await _context.Attaches
                        .Where(a => a.Active == 1 && a.IdTabla== idTabla && a.TypeDocto==typDocto)
                        .AsNoTracking()
                        .ToListAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error retrieving Attachs");
                    throw;
                }
            }

        public async Task<IEnumerable<Attach>> GetxTypedocto(string docto)
        {
            try
            {
                return await _context.Attaches
                    .Where(a => a.Active == 1 && a.TypeDocto == docto)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Attachs");
                throw;
            }
        }

        public async Task Save(Attach at)
        {
            try
            {
                _context.Attaches.Add(at);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Attachs");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Attachs");
                throw;
            }
        }

        public async Task<bool> Update(int id, Attach  at)
        {
            var exist = await _context.Attaches.FindAsync(id);
            if (exist == null)
            {
                _logger.LogWarning("Attempted to update non-existent Attaches With ID {Id}", id);
                return false;
            }

            try
            {
                // Update only the properties that are allowed to be modified                
                exist.Docto = at.Docto;
                exist.TypeDocto = at.TypeDocto; 
                exist.Type  =   at.Type;                
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Attaches with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Attaches with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Attaches.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Attaches With ID");
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
                _logger.LogError(ex, "Concurrency error occurred while updating Attaches with ID ", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while Delete Logic Attacheswith ID ", id);
                throw;
            }
        }

    }

    public interface IAttachService
    {
        Task<IEnumerable<Attach>> GetxId(int idTabla, string typDocto);
        Task<IEnumerable<Attach>> GetxTypedocto(string docto);
        Task Save(Attach at);
        Task<bool> Update(int id, Attach at);
        Task<bool> Delete(int id);
    }
}
