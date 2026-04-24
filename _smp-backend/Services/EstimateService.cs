
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class EstimateService : IEstimateService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<EstimateService> _logger;

        public EstimateService(DbSmpContext context, ILogger<EstimateService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetEstimatesxRoot(int idRoot)
        {
            try
            {
                return await _context.Estimates
                    .Where(e => e.IdRoot== idRoot && e.Active)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdRoot,
                        e.Number,
                        e.IdContract,
                        e.TypeMoney,
                        e.DateStart,
                        e.DateEnd,
                        e.Dias,
                        e.AmountMX,
                        e.AmountDLL,
                        e.AcumulateMX,
                        e.AcumulateDLL,
                        e.Type,
                        e.AuthorizeUser,
                        e.Comment,
                        e.Active
                    })
                    .OrderByDescending(e => e.DateStart)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Estimates for Company {IdRoot}", idRoot);
                throw;
            }
        }

        public async Task<List<object>> GetEstimates(int idContract)
        {
            try
            {
                return await _context.Estimates
                    .Where(e => e.IdContract == idContract && e.Active)
                    .Select(e => new
                    {
                        e.Id,
                        e.Number,
                        e.IdContract,
                        e.TypeMoney,
                        e.DateStart,
                        e.DateEnd,
                        e.Dias,
                        e.AmountMX,
                        e.AmountDLL,
                        e.AcumulateMX,
                        e.AcumulateDLL,
                        e.Type,
                        e.AuthorizeUser,
                        e.Comment,
                        e.Active
                    })
                    .OrderByDescending(e => e.DateStart)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Estimates for contract {IdContract}", idContract);
                throw;
            }
        }

        public async Task<Estimate?> GetById(int id)
        {
            try
            {
                return await _context.Estimates
                    .Where(e => e.Id == id && e.Active)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Estimate with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(Estimate estimate)
        {
            try
            {
                // Calculate accumulated amounts based on previous estimates
                var previousEstimates = await _context.Estimates
                    .Where(e => e.IdContract == estimate.IdContract && e.Active)
                    .ToListAsync();

                estimate.AcumulateMX = previousEstimates.Sum(e => e.AmountMX) + estimate.AmountMX;
                estimate.AcumulateDLL = previousEstimates.Sum(e => e.AmountDLL) + estimate.AmountDLL;

                _context.Estimates.Add(estimate);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Estimate");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Estimate");
                throw;
            }
        }

        public async Task<Estimate?> Update(int id, Estimate estimate)
        {
            var existingItem = await _context.Estimates.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent Estimate with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.TypeMoney    = estimate.TypeMoney;    
                existingItem.Number       = estimate.Number;
                existingItem.IdContract   = estimate.IdContract;
                existingItem.DateStart    = estimate.DateStart;
                existingItem.DateEnd      = estimate.DateEnd;
                existingItem.AmountMX     = estimate.AmountMX;
                existingItem.AmountDLL    = estimate.AmountDLL;
                existingItem.Type         = estimate.Type;
                existingItem.AuthorizeUser = estimate.AuthorizeUser;
                existingItem.Comment      = estimate.Comment;

                // Recalculate accumulated amounts
                await RecalculateAccumulatedAmounts(existingItem.IdContract);

                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Estimate with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Estimate with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.Estimates.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Estimate with ID {Id}", id);
                return false;
            }

            try
            {
                existingItem.Active = false;
                await _context.SaveChangesAsync();

                // Recalculate accumulated amounts for remaining estimates
                await RecalculateAccumulatedAmounts(existingItem.IdContract);

                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Estimate with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Estimate with ID {Id}", id);
                throw;
            }
        }

        private async Task RecalculateAccumulatedAmounts(int contractId)
        {
            try
            {
                var estimates = await _context.Estimates
                    .Where(e => e.IdContract == contractId && e.Active)
                    .OrderBy(e => e.DateStart)
                    .ToListAsync();

                decimal accumulatedMX = 0;
                decimal accumulatedDLL = 0;

                foreach (var estimate in estimates)
                {
                    accumulatedMX += estimate.AmountMX;
                    accumulatedDLL += estimate.AmountDLL;

                    estimate.AcumulateMX = accumulatedMX;
                    estimate.AcumulateDLL = accumulatedDLL;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recalculating accumulated amounts for contract {ContractId}", contractId);
                throw;
            }
        }
    }

    public interface IEstimateService
    {
        Task<List<object>> GetEstimates(int idContract);
        Task<List<object>> GetEstimatesxRoot(int idRoot);
        Task<Estimate?> GetById(int id);
        Task Save(Estimate estimate);
        Task<Estimate?> Update(int id, Estimate estimate);
        Task<bool> Delete(int id);
    }
}