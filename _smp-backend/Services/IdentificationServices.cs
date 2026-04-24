using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class IdentificationServices : IidentificationService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<IdentificationServices> _logger;

        public IdentificationServices(DbSmpContext dbContext, ILogger<IdentificationServices> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Identification>> Get(int idProject)
        {
            try
            {
                return await _context.Identifications
                    .Where(id => id.IdProject == idProject && id.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Identifications");
                throw;
            }
        }
                
        public async Task<List<object>> IdentificationFields(int idProject)
        {
            try
            {
                return await _context.Identifications
                    .Where(id => id.IdProject == idProject && id.Active == 1)
                    .Select(i => new
                    {
                        i.Event,
                        i.Description,
                        i.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Identification fields");
                throw;
            }
        }

        public async Task<Identification> Save(Identification identification)
        {
            try
            {
                _logger.LogInformation($"Attempting to save Identification. Id before save: {identification.Id}");
                identification.Id = 0;
                _logger.LogInformation($"Id set to 0. Attempting to add to context.");
                _context.Identifications.Add(identification);
                _logger.LogInformation("Calling SaveChangesAsync.");
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Save successful. New Id: {identification.Id}");
                return identification;
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Identification");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Identification");
                throw;
            }
        }

        public async Task<Identification?> Update(int id, Identification identification)
        {
            var existing = await _context.Identifications.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Identification with ID {Id}", id);
                return null;
            }
            try
            {
                // Update only the properties that are allowed to be modified
                existing.IdProject = identification.IdProject;
                existing.Event = identification.Event;
                existing.Clasification = identification.Clasification;
                existing.DateRegistry = identification.DateRegistry;
                existing.Description = identification.Description;
                existing.Cause = identification.Cause;
                existing.Administrator = identification.Administrator;
                existing.Active = identification.Active;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Identification with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Identification with ID {Id}", id);
                throw;
            }
        }


        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Identifications.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Identification With ID ", id);
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
                _logger.LogError(ex, "Concurrency error occurred while updating identification with ID", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Identification with ID ", id);
                throw;
            }
        }


    }

    public interface IidentificationService
    {
        Task<List<Identification>> Get(int idProject);
        Task<Identification> Save(Identification identification);
        Task<Identification?> Update(int id, Identification identification);
        Task<bool> Delete(int id);
    }
}
