using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class WorkprogramApuService : IWorkprogramApuService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<WorkprogramApuService> _logger;

        public WorkprogramApuService(DbSmpContext context, ILogger<WorkprogramApuService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<WorkprogramApu>> GetByWorkprogram(int idWorkprogram)
        {
            try
            {
                return await _context.WorkprogramApus
                    .Where(a => a.IdWorkprogram == idWorkprogram && a.Active)
                    .OrderBy(a => a.Type).ThenBy(a => a.Id)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving APU for workprogram {Id}", idWorkprogram);
                throw;
            }
        }

        /// <summary>Suma de totales con apply_to_cost=true — para actualizar costMX del concepto</summary>
        public async Task<decimal> GetAppliedTotal(int idWorkprogram)
        {
            try
            {
                var items = await _context.WorkprogramApus
                    .Where(a => a.IdWorkprogram == idWorkprogram && a.Active && a.ApplyToCost)
                    .AsNoTracking()
                    .ToListAsync();

                return items.Sum(a => a.Total ?? 0);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating applied total for workprogram {Id}", idWorkprogram);
                throw;
            }
        }

        public async Task<WorkprogramApu> Save(WorkprogramApu apu)
        {
            try
            {
                apu.Id = 0;
                _context.WorkprogramApus.Add(apu);
                await _context.SaveChangesAsync();
                return apu;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving APU");
                throw;
            }
        }

        public async Task<WorkprogramApu?> Update(int id, WorkprogramApu apu)
        {
            var existing = await _context.WorkprogramApus.FindAsync(id);
            if (existing == null) return null;

            try
            {
                existing.Type         = apu.Type;
                existing.IdReference  = apu.IdReference;
                existing.Description  = apu.Description;
                existing.Unit         = apu.Unit;
                existing.Quantity     = apu.Quantity;
                existing.UnitCost     = apu.UnitCost;
                existing.UnitCostDll  = apu.UnitCostDll;
                existing.ApplyToCost  = apu.ApplyToCost;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating APU {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.WorkprogramApus.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting APU {Id}", id);
                throw;
            }
        }
    }

    public interface IWorkprogramApuService
    {
        Task<List<WorkprogramApu>> GetByWorkprogram(int idWorkprogram);
        Task<decimal> GetAppliedTotal(int idWorkprogram);
        Task<WorkprogramApu> Save(WorkprogramApu apu);
        Task<WorkprogramApu?> Update(int id, WorkprogramApu apu);
        Task<bool> Delete(int id);
    }
}
