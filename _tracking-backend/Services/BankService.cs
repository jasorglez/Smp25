
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MicroServicioTracking.Services
{
    public class BankService : IBankService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<BankService> _logger;

        public BankService(DbTrackingContext context, ILogger<BankService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Bank>> GetAll()
        {
            try
            {
                return await _context.Banks
                    .AsNoTracking()
                    .OrderBy(b => b.Name)
                    .Where(b => b.Active == true) 
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all banks");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
          {
            try
            {
                return await _context.Banks
            .Where(b => b.Active)
                  .Select(e => new
                  {
                      e.Id,
                      e.Name,
                      e.Active
                  })
                  .AsNoTracking()
                   .OrderBy(b => b.Name)
                  .ToListAsync<object>();
            }            
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all banks");
                throw;
            }
        }

        public async Task<Bank?> GetById(int id)
        {
            try
            {
                return await _context.Banks
                    .AsNoTracking()
                    .FirstOrDefaultAsync(b => b.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Bank with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(Bank bank)
        {
            try
            {
                _context.Banks.Add(bank);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Bank");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Bank");
                throw;
            }
        }

        public async Task<Bank?> Update(int id, Bank bank)
        {
            var existingBank = await _context.Banks.FindAsync(id);
            if (existingBank == null)
            {
                _logger.LogWarning("Attempted to update non-existent Bank with ID {Id}", id);
                return null;
            }

            try
            {
                existingBank.Name = bank.Name;
                existingBank.Branch = bank.Branch;
                existingBank.NumBranch = bank.NumBranch;
                existingBank.Contact = bank.Contact;
                existingBank.Phone = bank.Phone;
                existingBank.Picture = bank.Picture;
                existingBank.Code = bank.Code;
                existingBank.Active = bank.Active;

                await _context.SaveChangesAsync();
                return existingBank;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Bank with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Bank with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingBank = await _context.Banks.FindAsync(id);
            if (existingBank == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Bank with ID {Id}", id);
                return false;
            }

            try
            {
                existingBank.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Bank with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Bank with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IBankService
    {
        Task<List<Bank>> GetAll();
        Task<List<object>> Get2fields();
        Task<Bank?> GetById(int id);
        Task Save(Bank bank);
        Task<Bank?> Update(int id, Bank bank);
        Task<bool> Delete(int id);
    }
}
