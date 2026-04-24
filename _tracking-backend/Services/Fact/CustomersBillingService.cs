using MicroServicioTracking.Models.Fact;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;


namespace MicroServicioTracking.Services.Fact;

public class CustomersBillingService : ICustomersBillingService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CustomersBillingService> _logger;

    public CustomersBillingService(DbTrackingContext context, ILogger<CustomersBillingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<CustomersBilling>> GetByRoot(int idRoot)
    {
        try
        {
            return await _context.CustomersBillings
                .Where(cb => cb.IdRoot == idRoot && cb.Active)
                .OrderBy(cb => cb.NombreFiscal)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers billing for root {IdRoot}", idRoot);
            throw;
        }
    }

    public async Task<List<CustomersBilling>> GetByCustomer(int idCustomer)
    {
        try
        {
            return await _context.CustomersBillings
                .Where(cb => cb.IdCustomer == idCustomer && cb.Active)
                .OrderBy(cb => cb.NombreFiscal)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers billing for customer {IdCustomer}", idCustomer);
            throw;
        }
    }

    public async Task<CustomersBilling?> GetById(int id)
    {
        try
        {
            return await _context.CustomersBillings
                .FirstOrDefaultAsync(cb => cb.Id == id && cb.Active);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer billing {Id}", id);
            throw;
        }
    }

    public async Task Save(CustomersBilling customer)
    {
        try
        {
            _context.CustomersBillings.Add(customer);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving customer billing");
            throw;
        }
    }

    public async Task<CustomersBilling?> Update(int id, CustomersBilling customer)
    {
        var existing = await _context.CustomersBillings.FindAsync(id);
        if (existing == null)
        {
            _logger.LogWarning("Attempted to update non-existent customer billing {Id}", id);
            return null;
        }

        try
        {
            existing.IdCustomer = customer.IdCustomer;
            existing.Rfc = customer.Rfc;
            existing.NombreFiscal = customer.NombreFiscal;
            existing.CodigoPostal = customer.CodigoPostal;
            existing.RegimenFiscal = customer.RegimenFiscal;
            existing.UsoCfdi = customer.UsoCfdi;
            existing.CorreoFacturacion = customer.CorreoFacturacion;
            existing.Active = customer.Active;

            await _context.SaveChangesAsync();
            return existing;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer billing {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existing = await _context.CustomersBillings.FindAsync(id);
        if (existing == null)
        {
            _logger.LogWarning("Attempted to delete non-existent customer billing {Id}", id);
            return false;
        }

        try
        {
            existing.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting customer billing {Id}", id);
            throw;
        }
    }
}

public interface ICustomersBillingService
{
    Task<List<CustomersBilling>> GetByRoot(int idRoot);
    Task<List<CustomersBilling>> GetByCustomer(int idCustomer);
    Task<CustomersBilling?> GetById(int id);
    Task Save(CustomersBilling customer);
    Task<CustomersBilling?> Update(int id, CustomersBilling customer);
    Task<bool> Delete(int id);
}