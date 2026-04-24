using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ItemsGeneradoresEstimateService : IItemsGeneradoresEstimateService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ItemsGeneradoresEstimateService> _logger;

        public ItemsGeneradoresEstimateService(DbSmpContext context, ILogger<ItemsGeneradoresEstimateService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetItemsGeneradoresEstimates(int idType, string type)
        {
            try
            {
                return await _context.ItemsGeneradoresEstimates
                    .Where(i => i.IdType == idType && i.Active && i.Type == type)
                    .Select(i => new
                    {
                        i.Id,
                        i.IdType,
                        i.IdResource,
                        i.Quantity,
                        i.Accumulate,
                        i.Type,
                        i.Comment,
                        i.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ItemsGeneradoresEstimates for resource {IdResource} and type {Type}", idType, type);
                throw;
            }
        }


        public async Task<ItemsGeneradoresEstimate?> GetItemsGeneradoresEstimateById(int id, string type)
        {
            try
            {
                return await _context.ItemsGeneradoresEstimates
                    .AsNoTracking()
                    .FirstOrDefaultAsync(i => i.Id == id && i.Active && i.Type == type);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ItemsGeneradoresEstimate with ID {Id} and type {Type}", id, type);
                throw;
            }
        }

        public async Task Save(ItemsGeneradoresEstimate itemsGeneradoresEstimate)
        {
            try
            {
                // Calculate accumulated quantity based on previous items of the same type
                var previousItems = await _context.ItemsGeneradoresEstimates
                    .Where(i => i.IdResource == itemsGeneradoresEstimate.IdResource && i.Active && i.Type == itemsGeneradoresEstimate.Type)
                    .ToListAsync();

                itemsGeneradoresEstimate.Accumulate = previousItems.Sum(i => i.Quantity ?? 0) + (itemsGeneradoresEstimate.Quantity ?? 0);

                _context.ItemsGeneradoresEstimates.Add(itemsGeneradoresEstimate);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving ItemsGeneradoresEstimate");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ItemsGeneradoresEstimate");
                throw;
            }
        }

        public async Task<ItemsGeneradoresEstimate?> Update(int id, ItemsGeneradoresEstimate itemsGeneradoresEstimate)
        {
            var existingItem = await _context.ItemsGeneradoresEstimates
                .FirstOrDefaultAsync(i => i.Id == id && i.Active && i.Type == itemsGeneradoresEstimate.Type);

            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent ItemsGeneradoresEstimate with ID {Id} and type {Type}", id, itemsGeneradoresEstimate.Type);
                return null;
            }

            try
            {
                existingItem.IdType = itemsGeneradoresEstimate.IdType;
                existingItem.IdResource = itemsGeneradoresEstimate.IdResource;
                existingItem.Quantity = itemsGeneradoresEstimate.Quantity;
                existingItem.Type = itemsGeneradoresEstimate.Type;
                existingItem.Comment = itemsGeneradoresEstimate.Comment;

                // Recalculate accumulated quantities for the same type
                await RecalculateAccumulatedQuantities(existingItem.IdResource, existingItem.Type);

                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ItemsGeneradoresEstimate with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ItemsGeneradoresEstimate with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id, string type)
        {
            var existingItem = await _context.ItemsGeneradoresEstimates
                .FirstOrDefaultAsync(i => i.Id == id && i.Active && i.Type == type);

            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent ItemsGeneradoresEstimate with ID {Id} and type {Type}", id, type);
                return false;
            }

            try
            {
                existingItem.Active = false;
                await _context.SaveChangesAsync();

                // Recalculate accumulated quantities for remaining items of the same type
                await RecalculateAccumulatedQuantities(existingItem.IdResource, existingItem.Type);

                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting ItemsGeneradoresEstimate with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ItemsGeneradoresEstimate with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> ExistsAsync(int id, string type)
        {
            try
            {
                return await _context.ItemsGeneradoresEstimates.AnyAsync(i => i.Id == id && i.Active && i.Type == type);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if ItemsGeneradoresEstimate exists with ID {Id} and type {Type}", id, type);
                throw;
            }
        }

        private async Task RecalculateAccumulatedQuantities(int? resourceId, string? type)
        {
            try
            {
                if (!resourceId.HasValue || string.IsNullOrEmpty(type)) return;

                var items = await _context.ItemsGeneradoresEstimates
                    .Where(i => i.IdResource == resourceId && i.Active && i.Type == type)
                    .OrderBy(i => i.Id) // Assuming chronological order by Id
                    .ToListAsync();

                decimal accumulated = 0;

                foreach (var item in items)
                {
                    accumulated += item.Quantity ?? 0;
                    item.Accumulate = accumulated;
                }

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error recalculating accumulated quantities for resource {ResourceId} and type {Type}", resourceId, type);
                throw;
            }
        }
    }

        public interface IItemsGeneradoresEstimateService
        {
            Task<List<object>> GetItemsGeneradoresEstimates(int idType, string type);
            Task<ItemsGeneradoresEstimate?> GetItemsGeneradoresEstimateById(int id, string type);
            Task Save(ItemsGeneradoresEstimate itemsGeneradoresEstimate);
            Task<ItemsGeneradoresEstimate?> Update(int id, ItemsGeneradoresEstimate itemsGeneradoresEstimate);
            Task<bool> Delete(int id, string type);
            Task<bool> ExistsAsync(int id, string type);            
        }
    }

