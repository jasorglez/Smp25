using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class SalesxcustomerService : ISalesxcustomerService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<SalesxcustomerService> _logger;

        public SalesxcustomerService(DbTrackingContext context, ILogger<SalesxcustomerService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetByCustomerId(int customerId)
        {
            try
            {
                return await _context.Salesxcustomers
                    .Where(s => s.IdCustomer == customerId && s.Active == true)
                    .Select(s => new
                    {
                        s.Id,
                        s.IdCustomer,
                        s.Date,s.NumberNote,
                        s.Lector,
                        s.Credit,
                        s.Amount,
                        s.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Sales for Customer ID {Id}", customerId);
                throw;
            }
        }

        public async Task<Salesxcustomer?> GetById(int id)
        {
            try
            {
                return await _context.Salesxcustomers
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == id && s.Active == true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Sale with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(Salesxcustomer sale)
        {
            try
            {
                _context.Salesxcustomers.Add(sale);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Sale");
                throw;
            }
        }

        public async Task<Salesxcustomer?> Update(int id, Salesxcustomer sale)
        {
            var existingSale = await _context.Salesxcustomers.FindAsync(id);
            if (existingSale == null)
            {
                _logger.LogWarning("Attempted to update non-existent Sale with ID {Id}", id);
                return null;
            }

            try
            {
                existingSale.IdCustomer = sale.IdCustomer;
                existingSale.Date = sale.Date;
                existingSale.Lector = sale.Lector;
                existingSale.Credit = sale.Credit;
                existingSale.Amount = sale.Amount;
                existingSale.Active = sale.Active;

                await _context.SaveChangesAsync();
                return existingSale;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Sale with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingSale = await _context.Salesxcustomers.FindAsync(id);
            if (existingSale == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Sale with ID {Id}", id);
                return false;
            }

            try
            {
                existingSale.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Sale with ID {Id}", id);
                throw;
            }
        }
    }

    public interface ISalesxcustomerService
    {
        Task<List<object>> GetByCustomerId(int customerId);
        Task<Salesxcustomer?> GetById(int id);
        Task Save(Salesxcustomer sale);
        Task<Salesxcustomer?> Update(int id, Salesxcustomer sale);
        Task<bool> Delete(int id);
    }
}