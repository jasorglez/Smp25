using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class WorkprogramApuFactorService : IWorkprogramApuFactorService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<WorkprogramApuFactorService> _logger;

        public WorkprogramApuFactorService(DbSmpContext context, ILogger<WorkprogramApuFactorService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<WorkprogramApuFactor>> GetByContract(int idContract)
        {
            try
            {
                return await _context.WorkprogramApuFactors
                    .Where(f => f.IdContract == idContract && f.Active)
                    .OrderBy(f => f.SortOrder)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving APU factors for contract {Id}", idContract);
                throw;
            }
        }

        public async Task<WorkprogramApuFactor> Save(WorkprogramApuFactor factor)
        {
            try
            {
                factor.Id = 0;
                _context.WorkprogramApuFactors.Add(factor);
                await _context.SaveChangesAsync();
                return factor;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving APU factor");
                throw;
            }
        }

        public async Task<WorkprogramApuFactor?> Update(int id, WorkprogramApuFactor factor)
        {
            var existing = await _context.WorkprogramApuFactors.FindAsync(id);
            if (existing == null) return null;

            try
            {
                existing.Name       = factor.Name;
                existing.Percentage = factor.Percentage;
                existing.SortOrder  = factor.SortOrder;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating APU factor {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.WorkprogramApuFactors.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting APU factor {Id}", id);
                throw;
            }
        }
    }

    public interface IWorkprogramApuFactorService
    {
        Task<List<WorkprogramApuFactor>> GetByContract(int idContract);
        Task<WorkprogramApuFactor> Save(WorkprogramApuFactor factor);
        Task<WorkprogramApuFactor?> Update(int id, WorkprogramApuFactor factor);
        Task<bool> Delete(int id);
    }
}
