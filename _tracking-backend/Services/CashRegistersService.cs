using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class CashRegistersService: ICashRegistersService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CashRegistersService> _logger;
    
    public CashRegistersService(DbTrackingContext context , ILogger<CashRegistersService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<List<object>> GetByCashAll()
    {
        try
        {
            return await _context.CashRegisterXBranchs
                .Select(c => new
                {
                    c.IdStore,
                    c.Description,
                    c.DescCashRegister,
                    c.IdBranch,
                    c.Name,
                    c.IdRoot,
                    c.IdCaja,
                    c.NameSmall
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Cash Registers for Store ID {Id}");
            throw;
        }
    }
    
    public async Task<List<object>> GetCashByBranch(int IdBranch)
    {
        try
        {
            return await _context.CashRegisterXBranchs
                .Where(c => c.IdBranch == IdBranch)
                .Select(c => new
                {
                    c.IdStore,
                    c.IdCaja,
                    c.Description,
                    c.DescCashRegister,
                    c.IdBranch,
                    c.Name,
                    c.NameSmall
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Cash Registers for Store ID {Id}", IdBranch);
            throw;
        }
    }

    public async Task<List<object>> GetCashByCompany(int idCompany)
    {
        try
        {
            return await _context.CashRegisterXBranchs
                .Where(c => c.IdRoot == idCompany)
                .Select(c => new
                {
                    c.IdStore,
                    c.IdCaja,
                    c.Description,
                    c.DescCashRegister,
                    c.IdBranch,
                    c.Name,
                    c.IdRoot,
                    c.NameSmall
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Cash Registers for Store ID {Id}", idCompany);
            throw;
        }
    }
    
    public async Task<List<object>> GetByStore(int storeId)
    {
        try
        {
            return await _context.CashRegisters
                .Where(c => c.IdStore == storeId && c.Active)
                .Select(c => new
                {
                    c.Id,
                    c.IdStore,
                    c.Description,
                    c.Active
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Cash Registers for Store ID {Id}", storeId);
            throw;
        }
    }

    public async Task<CashRegisters?> GetById(int id)
    {
        try
        {
            return await _context.CashRegisters
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id && c.Active);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Cash Register with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<CashRegisters?>  Save(CashRegisters cashRegister)
    {
            CashRegisters idGenerado = new CashRegisters();
        try
        {
            if (cashRegister.Id == 0)
            {
                _context.CashRegisters.Add(cashRegister);
            }
            else
            {
                _context.CashRegisters.Update(cashRegister);
            }
            var result = await _context.SaveChangesAsync();
            if(result > 0){
               idGenerado.Id = cashRegister.Id;
                return idGenerado; 
            }else {
                return null;
            }
            
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Cash Register with ID {Id}", cashRegister.Id);
            throw;
        }
    }
    
    public async Task<CashRegisters?> Update(int id, CashRegisters cashRegister)
    {
        try
        {
            var existingCashRegister = await _context.CashRegisters
                .FirstOrDefaultAsync(c => c.Id == id && c.Active);
            if (existingCashRegister == null)
            {
                return null;
            }
            existingCashRegister.Description = cashRegister.Description;
            existingCashRegister.Active = cashRegister.Active;
            await _context.SaveChangesAsync();
            return existingCashRegister;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Cash Register with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<bool> Delete(int id)
    {
        try
        {
            var cashRegister = await _context.CashRegisters.FindAsync(id);
            if (cashRegister == null)
            {
                return false;
            }
            cashRegister.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Cash Register with ID {Id}", id);
            throw;
        }
    }
}

public interface ICashRegistersService
{
    Task<List<object>> GetByStore(int storeId);
    Task<CashRegisters?> GetById(int id);
    Task<CashRegisters?> Save(CashRegisters cashRegister);
    Task<CashRegisters?> Update(int id, CashRegisters cashRegister);
    Task<bool> Delete(int id);
    Task<List<object>> GetCashByCompany(int idCompany);
    Task<List<object>> GetCashByBranch(int IdBranch);
    Task<List<object>> GetByCashAll();
}