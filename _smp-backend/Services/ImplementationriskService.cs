using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ImplementationriskService : IImplementationriskService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ImplementationriskService> _logger;

        public ImplementationriskService(DbSmpContext context, ILogger<ImplementationriskService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetImplementationRisks(int idPlanification)
        {
            try
            {
                return await _context.Implementationrisks
                    .Where(p => p.IdPlanification == idPlanification && p.Active)
                    .Select(p => new
                    {
                        p.Id,
                        p.IdPlanification,
                        p.Probability,
                        p.Reach,
                        p.Time,
                        p.Cost,
                        p.Quality,
                        p.Qualification,
                        p.State,
                        p.AdvancedReal,
                        p.AdvancedPlanning,
                        p.Spi,
                        p.Status,
                        p.Condition,
                        p.DateClose,
                        p.Observation,
                        p.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ImplementationRisks for planification {IdPlanification}", idPlanification);
                throw;
            }
        }

        public async Task Save(Implementationrisk implementationRisk)
        {
            try
            {
                _context.Implementationrisks.Add(implementationRisk);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving ImplementationRisk");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ImplementationRisk");
                throw;
            }
        }

        public async Task<Implementationrisk?> Update(int id, Implementationrisk implementationRisk)
        {
            var existingItem = await _context.Implementationrisks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent ImplementationRisk with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.IdPlanification = implementationRisk.IdPlanification;
                existingItem.Probability = implementationRisk.Probability;
                existingItem.Reach = implementationRisk.Reach;
                existingItem.Time = implementationRisk.Time;
                existingItem.Cost = implementationRisk.Cost;
                existingItem.Quality = implementationRisk.Quality;
                existingItem.Qualification = implementationRisk.Qualification;
                existingItem.State = implementationRisk.State;
                existingItem.AdvancedReal = implementationRisk.AdvancedReal;
                existingItem.AdvancedPlanning = implementationRisk.AdvancedPlanning;
                existingItem.Status = implementationRisk.Status;
                existingItem.Condition = implementationRisk.Condition;
                existingItem.DateClose = implementationRisk.DateClose;
                existingItem.Observation = implementationRisk.Observation;
                
                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ImplementationRisk with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ImplementationRisk with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.Implementationrisks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent ImplementationRisk with ID {Id}", id);
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
                _logger.LogError(ex, "Concurrency error occurred while deleting ImplementationRisk with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ImplementationRisk with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IImplementationriskService
    {
            Task<List<object>> GetImplementationRisks(int idPlanification);
            Task Save(Implementationrisk implementationRisk);
            Task<Implementationrisk?> Update(int id, Implementationrisk implementationRisk);
            Task<bool> Delete(int id);
    }
  
}