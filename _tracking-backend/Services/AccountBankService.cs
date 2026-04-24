using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MicroServicioTracking.Services
{

    public class AccountBankService : IAccountBankService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<AccountBankService> _logger;

        public AccountBankService(DbTrackingContext context, ILogger<AccountBankService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }


        public async Task<List<object>> Accounts(int id)
        {
            try
            {
                return await _context.AccountBanks
                    .Join(_context.Banks,
                        a => a.IdBanco,
                        b => b.Id,
                        (a, b) => new { AccountBank = a, Bank = b })
                    .GroupJoin(_context.Incomeandexpenses,
                        comb => comb.AccountBank.Id,
                        i => i.IdAccount,
                        (comb, incomes) => new { comb.AccountBank, comb.Bank, Incomes = incomes })
                    .Where(comb => comb.AccountBank.IdBussines == id && comb.AccountBank.Active)
                    .Select(comb => new
                    {
                        comb.AccountBank.Id,
                        comb.AccountBank.IdBussines,
                        comb.AccountBank.NumberAccount,
                        comb.AccountBank.NameAccount,
                        comb.AccountBank.SignAccount,
                        comb.AccountBank.Interbancaria,
                        comb.AccountBank.FolioCheque,
                        comb.AccountBank.FolioSinCheque,
                        comb.AccountBank.IdBanco,
                        BankName = comb.Bank.Name,
                        comb.AccountBank.Maskin,
                        comb.AccountBank.Consecin,
                        comb.AccountBank.Maskex,
                        comb.AccountBank.Consecex,
                        comb.AccountBank.EAplicaFiscal,
                        comb.AccountBank.Active,
                        Gasto = comb.Incomes
                            .Where(i => i.Type == "GASTO")
                            .Sum(i => i.Total),
                        DepositoPagado = comb.Incomes
                            .Where(i => i.Type == "DEPOSITO" && i.Status == "Pagada")
                            .Sum(i => i.Total),
                        Saldo = comb.Incomes
                            .Where(i => i.Type == "DEPOSITO" && i.Status == "Pagada")
                            .Sum(i => i.Total) -
                            comb.Incomes
                            .Where(i => i.Type == "GASTO")
                            .Sum(i => i.Total)
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AccountBank with ID {Id}", id);
                throw;
            }
        }

        public async Task<List<object>> Accounts2(int id)
        {
            try
            {
                return await _context.AccountBanks
                    .Join(_context.Banks,
                        a => a.IdBanco,
                        b => b.Id,
                        (a, b) => new
                        {
                            AccountBank = a,
                            Bank = b
                        })
                    .Where(a => a.AccountBank.IdBussines == id && a.AccountBank.Active)
                    .Select(comb => new
                    {
                        comb.AccountBank.Id,
                        comb.AccountBank.IdBussines,
                        comb.AccountBank.NumberAccount,
                        comb.AccountBank.NameAccount,
                        comb.AccountBank.SignAccount,
                        comb.AccountBank.Interbancaria,
                        comb.AccountBank.FolioCheque,
                        comb.AccountBank.FolioSinCheque,
                        comb.AccountBank.IdBanco,
                        BankName = comb.Bank.Name,
                        comb.AccountBank.Maskin,
                        comb.AccountBank.Consecin,
                        comb.AccountBank.Maskex,
                        comb.AccountBank.Consecex,
                        comb.AccountBank.EAplicaFiscal,
                        comb.AccountBank.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AccountBank with ID {Id}", id);
                throw;
            }
        }

        public async Task<List<object>> Accountsxbanks(int id)
        {
            try
            {
                return await _context.AccountBanks
                    .Join(_context.Banks,
                          a => a.IdBanco,
                          b => b.Id,
                          (a, b) => new
                          {
                              AccountBank = a,
                              Bank = b
                          })
                    .Where(a => a.AccountBank.IdBussines == id && a.AccountBank.Active)
                    .Select(comb => new
                    {
                        AccountId     = comb.AccountBank.Id,
                        AccountNumber = comb.AccountBank.NumberAccount,
                        AccountName   = comb.AccountBank.NameAccount,
                        BankId        = comb.Bank.Id,
                        BankName      = comb.Bank.Name,
                        Activo        = comb.AccountBank.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AccountBank with ID {Id}", id);
                throw;
            }
        }


        public async Task Save(AccountBank accountBank)
        {
            try
            {
                _context.AccountBanks.Add(accountBank);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving AccountBank");
                throw;
            }
        }

        public async Task<AccountBank?> Update(int id, AccountBank accountBank)
        {
            var existingItem = await _context.AccountBanks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent AccountBank with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.IdBussines     = accountBank.IdBussines;
                existingItem.NumberAccount  = accountBank.NumberAccount;
                existingItem.NameAccount    = accountBank.NameAccount;
                existingItem.SignAccount    = accountBank.SignAccount;
                existingItem.Interbancaria  = accountBank.Interbancaria;
                existingItem.FolioCheque    = accountBank.FolioCheque;
                existingItem.FolioSinCheque = accountBank.FolioSinCheque;
                existingItem.IdBanco        = accountBank.IdBanco;
                existingItem.Maskin         = accountBank.Maskin;
                existingItem.Consecin       = accountBank.Consecin;
                existingItem.Maskex         = accountBank.Maskex;
                existingItem.Consecex       = accountBank.Consecex;
                existingItem.EAplicaFiscal  = accountBank.EAplicaFiscal;
                existingItem.Active         = accountBank.Active;

                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating AccountBank with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.AccountBanks.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent AccountBank with ID {Id}", id);
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
                _logger.LogError(ex, "Error deleting AccountBank with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IAccountBankService
    {
        Task<List<object>> Accounts(int id);
        Task<List<object>> Accountsxbanks(int id);
        Task Save(AccountBank accountBank);
        Task<AccountBank?> Update(int id, AccountBank accountBank);
        Task<bool> Delete(int id);
    }

}
