
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MicroServicioTracking.Services
{
    public class ExpensecategoryService : IExpenseCategoryService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<ExpensecategoryService> _logger;

        public ExpensecategoryService(DbTrackingContext context, ILogger<ExpensecategoryService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetByBusiness(int id)
        {
            try
            {
                return await _context.expensecategorys
                    .Where(e => e.IdBusinnes == id && e.Active)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBusinnes,
                        e.Code,
                        e.Name,
                        e.Type,
                        e.ParentCategoryId,
                        e.MaxAmount,
                        e.RequiresApproval,
                        e.ApprovalLevel,
                        e.CostCenter,
                        e.AccountingCode,
                        e.TaxType,
                        e.DeductiblePercentage,
                        e.RequiresVoucher,
                        e.CreatedBy,
                        e.CreatedAt,
                        e.ModifiedBy,
                        e.ModifiedAt,
                        e.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ExpenseCategories for Business ID {Id}", id);
                throw;
            }
        }

        public async Task Save(expensecategory expenseCategory)
        {
            try
            {
                _context.expensecategorys.Add(expenseCategory);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ExpenseCategory");
                throw;
            }
        }

        public async Task<expensecategory?> Update(int id, expensecategory expenseCategory)
        {
            var existingItem = await _context.expensecategorys.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent ExpenseCategory with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.IdBusinnes           = expenseCategory.IdBusinnes;
                existingItem.Code                 = expenseCategory.Code;
                existingItem.Name                 = expenseCategory.Name;
                existingItem.Type                 = expenseCategory.Type;
                existingItem.ParentCategoryId     = expenseCategory.ParentCategoryId;
                existingItem.MaxAmount            = expenseCategory.MaxAmount;
                existingItem.RequiresApproval     = expenseCategory.RequiresApproval;
                existingItem.ApprovalLevel        = expenseCategory.ApprovalLevel;
                existingItem.CostCenter           = expenseCategory.CostCenter;
                existingItem.AccountingCode       = expenseCategory.AccountingCode;
                existingItem.TaxType              = expenseCategory.TaxType;
                existingItem.DeductiblePercentage = expenseCategory.DeductiblePercentage;
                existingItem.RequiresVoucher      = expenseCategory.RequiresVoucher;
                existingItem.ModifiedBy           = expenseCategory.ModifiedBy;
                existingItem.ModifiedAt           = DateTime.Now;
                existingItem.Active               = expenseCategory.Active;

                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ExpenseCategory with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.expensecategorys.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent ExpenseCategory with ID {Id}", id);
                return false;
            }

            try
            {
                existingItem.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ExpenseCategory with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IExpenseCategoryService
    {
        Task<List<object>> GetByBusiness(int id);
        Task Save(expensecategory expenseCategory);
        Task<expensecategory?> Update(int id, expensecategory expenseCategory);
        Task<bool> Delete(int id);
    }
}
