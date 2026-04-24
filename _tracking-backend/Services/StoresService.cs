using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class StoresService: IStoresService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<StoresService> _logger;
    
    public StoresService(DbTrackingContext context, ILogger<StoresService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<object>> GetBranchAllCompany()
    {
        try
        {
            var companyBranches = await _context.ActiveBranchIds
                .AsNoTracking()
                .ToListAsync();

            var branchIds = companyBranches
                .SelectMany(ab => ab.BranchIds.Split(',')
                    .Select(id => int.Parse(id.Trim())))
                .Distinct()
                .ToList();

            var stores = await _context.Stores
                .Where(s => branchIds.Contains(s.IdBranch) && s.Active)
                .AsNoTracking()
                .ToListAsync();

            var branchToCompanyInfo = new Dictionary<int, (int idCompany, string name)>();
            foreach (var cb in companyBranches)
            {
                var ids = cb.BranchIds.Split(',')
                    .Select(id => int.Parse(id.Trim()));

                foreach (var id in ids)
                {
                    if (!branchToCompanyInfo.ContainsKey(id))
                    {
                        branchToCompanyInfo[id] = (cb.idCompany, cb.NameSmall ?? "Sin nombre");
                    }
                }
            }

            var result = stores.Select(s => new
            {
                s.Id,
                s.IdBranch,
                IdCompany = branchToCompanyInfo.TryGetValue(s.IdBranch, out var info) ? info.idCompany : 0,
                CompanyName = branchToCompanyInfo.TryGetValue(s.IdBranch, out var companyInfo) ? companyInfo.name : "Desconocida",
                s.Description,
                s.Address,
                s.City,
                s.State,
                s.Cp,
                s.Phone,
                s.Active
            }).ToList<object>();

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Stores for all Company Branches");
            throw;
        }
    }



    public async Task<List<object>> GetStoresByCompanyBranches(int idCompany)
    {
        try
        {
            // Primero obtener los branch IDs para la compa��a
            var branchData = await _context.ActiveBranchIds
                .Where(a => a.idCompany == idCompany)
                .Select(ab => ab.BranchIds)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (string.IsNullOrEmpty(branchData))
            {
                return new List<object>();
            }

            // Convertir la cadena de IDs separados por comas a una lista de enteros
            var branchIds = branchData.Split(',')
                .Select(id => int.Parse(id.Trim()))
                .ToList();

            // Obtener todas las tiendas que pertenecen a estos branches
            return await _context.Stores
                .Where(s => branchIds.Contains(s.IdBranch) && s.Active)
                .Select(s => new
                {
                    s.Id,
                    s.IdBranch,
                    s.Description,
                    s.Address,
                    s.City,
                    s.State,
                    s.Cp,
                    s.Phone,
                    s.Active
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Stores for Company Branches");
            throw;
        }
    }

    public async Task<List<object>> GetByBranch(int branchId)
    {
        try
        {
            return await _context.Stores
                .Where(s => s.IdBranch == branchId && s.Active)
                .Select(s => new
                {
                    s.Id,
                    s.IdBranch,
                    s.Description,
                    s.Address,
                    s.City,
                    s.State,
                    s.Cp,
                    s.Phone,
                    s.Active
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Stores for Branch ID {Id}", branchId);
            throw;
        }
    }
    
    public async Task<Stores?> GetById(int id)
    {
        try
        {
            return await _context.Stores
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Id == id && s.Active);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Store with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<Stores?> Save(Stores store)
    {
        Stores idGenerado = new Stores();
        try
        {   
            _context.Stores.Add(store);
            var result = await _context.SaveChangesAsync();
            if(result > 0){
               idGenerado.Id = store.Id;
                return idGenerado; 
            }else {
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Store with ID {Id}", store.Id);
            throw;
        }
    }
    
    public async Task<Stores?> Update(int id, Stores store)
    {
        var existingStore = await _context.Stores.FindAsync(id);
        if (existingStore == null)
        {
            _logger.LogWarning("Attempted to update non-existent store with ID {Id}", id);
            return null;
        }

        try
        {
            existingStore.IdBranch    = store.IdBranch;
            existingStore.Description = store.Description;
            existingStore.Address     = store.Address;
            existingStore.City        = store.City;
            existingStore.State       = store.State;
            existingStore.Cp          = store.Cp;
            existingStore.Phone       = store.Phone;
            existingStore.Active      = store.Active;

            await _context.SaveChangesAsync();
            return existingStore;
        }
        catch(Exception ex)
        {
            _logger.LogError(ex, "Error updating Store with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<bool> Delete(int id)
    {
        var existingStore = await _context.Stores.FindAsync(id);
        if (existingStore == null)
        {
            _logger.LogWarning("Attempted to delete non-existent Store with ID {Id}", id);
            return false;
        }

        try
        {
            existingStore.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Store with ID {Id}", id);
            throw;
        }
    }
}

public interface IStoresService
{
    Task<List<object>> GetBranchAllCompany();
    Task<List<object>> GetStoresByCompanyBranches(int idCompany);
    Task<List<object>> GetByBranch(int branchId);
    Task<Stores?> GetById(int id);
    Task<Stores?> Save(Stores store);
    Task<Stores?> Update(int id, Stores store);
    Task<bool> Delete(int id);
}