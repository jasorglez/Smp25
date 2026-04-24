using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;


namespace SMP.Services
{
    
    public class PlanificationRiskService : IPlanificationRiskService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<PlanificationRiskService> _logger;

        public PlanificationRiskService(DbSmpContext context, ILogger<PlanificationRiskService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetPlanificationRisks(int idAnalisis)
        {
            try
            {
                return await _context.PlanificationRisks
                    .Where(p => p.IdAnalisis == idAnalisis && p.Active == true)
                    .Select(p => new
                    {
                        p.Id,
                        p.IdAnalisis,
                        p.Actions,
                        p.StartDate,
                        p.EndDate,
                        p.Period,
                        p.Resources,
                        p.Cost, p.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving PlanificationRisks for analysis {IdAnalisis}", idAnalisis);
                throw;
            }
        }

        public async Task Save(PlanificationRisk planificationRisk)
        {
            try
            {
                _context.PlanificationRisks.Add(planificationRisk);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving PlanificationRisk");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving PlanificationRisk");
                throw;
            }
        }

        public async Task<PlanificationRisk?> Update(int id, PlanificationRisk planificationRisk)
        {
            var existingItem = await _context.PlanificationRisks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent PlanificationRisk with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.IdAnalisis = planificationRisk.IdAnalisis;
                existingItem.Actions = planificationRisk.Actions;
                existingItem.StartDate = planificationRisk.StartDate;
                existingItem.EndDate = planificationRisk.EndDate;
                existingItem.Resources = planificationRisk.Resources;
                existingItem.Cost = planificationRisk.Cost;
                existingItem.Active = planificationRisk.Active;

                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating PlanificationRisk with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating PlanificationRisk with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.PlanificationRisks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent PlanificationRisk with ID {Id}", id);
                return false;
            }

            try
            {
                existingItem.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting PlanificationRisk with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting PlanificationRisk with ID {Id}", id);
                throw;
            }
        }

    }

    public interface IPlanificationRiskService
    {
        Task<List<object>> GetPlanificationRisks(int idAnalisis);
        Task Save(PlanificationRisk planificationRisk);
        Task<PlanificationRisk?> Update(int id, PlanificationRisk planificationRisk);
        Task<bool> Delete(int id);
    }

}