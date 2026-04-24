
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;


namespace SMP.Services
{
    public class ContingencyActionService : IContingencyActionService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ContingencyActionService> _logger;

        public ContingencyActionService(DbSmpContext context, ILogger<ContingencyActionService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Contingencyaction>> Get(int idAnalysis)
        {
            try
            {
                return await _context.Contigencyactions
                    .Where(ca => ca.idAnalysis== idAnalysis && ca.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ContingencyActions");
                throw;
            }
        }

        public async Task<Contingencyaction> Save(Contingencyaction ca)
        {
            try
            {
                _logger.LogInformation($"Attempting to save ContingencyAction. Id before save: {ca.Id}");
                ca.Id = 0;
                _context.Contigencyactions.Add(ca);
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Save successful. New Id: {ca.Id}");
                return ca;
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving ContingencyAction");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ContingencyAction");
                throw;
            }
        }

        public async Task<Contingencyaction?> Update(int id, Contingencyaction contingencyAction)
        {
            var existing = await _context.Contigencyactions.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent ContingencyAction with ID {Id}", id);
                return null;
            }
            try
            {
                // Update only the properties that are allowed to be modified
                existing.Actions = contingencyAction.Actions;
                existing.DateStart = contingencyAction.DateStart;
                existing.DateEnd = contingencyAction.DateEnd;
                existing.Period = contingencyAction.Period;
                existing.Resources = contingencyAction.Resources;
                existing.CostApprox = contingencyAction.CostApprox;
                existing.AdvancedReal = contingencyAction.AdvancedReal;
                existing.AdvancePlanned = contingencyAction.AdvancePlanned;
                existing.SPI = contingencyAction.SPI;
                existing.Days = contingencyAction.Days;
                existing.Status = contingencyAction.Status;
                existing.Observations = contingencyAction.Observations;
                existing.Active = contingencyAction.Active;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ContingencyAction with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ContingencyAction with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Contigencyactions.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to delete non-existent ContingencyAction with ID {Id}", id);
                return false;
            }
            try
            {
                existing.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ContingencyAction with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IContingencyActionService
    {
        Task<List<Contingencyaction>> Get(int idAnalysis);
        Task<Contingencyaction> Save(Contingencyaction ca);
        Task<Contingencyaction?> Update(int id, Contingencyaction contingencyAction);
        Task<bool> Delete(int id);
    }
}