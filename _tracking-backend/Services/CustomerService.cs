using System.Dynamic;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.View;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

public class CustomerService : ICustomerService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CustomerService> _logger;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly HttpClient _httpClient;
    private readonly IGetBranchesByCompanyService _branchesService;

    public CustomerService(DbTrackingContext context, ILogger<CustomerService> logger, IHttpContextAccessor httpContextAccessor,
        HttpClient httpClient,
        IGetBranchesByCompanyService branchesService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        _httpClient = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
    }

    public async Task<List<object>> GetByCompany(int idCompany, string Type)
    {
        try
        {
            // Consulta para obtener los customers
            var customers = await _context.Customers
                .Where(c => c.IdRoot == idCompany && c.Type == Type && c.Active && c.Vigente)
                .Select(c => new
                {
                    c.IdRoot,
                    c.Id,
                    c.IdBranch,
                    c.IdTypecop,
                    c.Cp,
                    c.Vigente,
                    name = c.Company,
                    Description = (c.NameContact ?? "").Trim()
                })
                .AsNoTracking()
                .ToListAsync<object>();

            return customers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for company ID ");
            throw;
        }
    }

    public async Task<List<object>> GetByCompanyforPalace(int idCompany)
    {
        try
        {
            // Consulta para obtener los customers
            var customers = await _context.Customers
                .Where(c => c.IdRoot == idCompany && c.Type =="CUSTOMERS" && c.Active)                
                .AsNoTracking()
                .ToListAsync<object>();

            return customers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for company ID ");
            throw;
        }
    }

    public async Task<List<object>> GetProvidersByCompany(int idCompany, string Type)
    {
        try
        {
            // Consulta para obtener los customers
            var customers = await _context.Customers
                .Where(c => c.IdRoot == idCompany && c.Type == Type)
                .OrderByDescending(c => c.Vigente)
                .ThenBy(c => string.IsNullOrWhiteSpace(c.Company) ? 1 : 0)
                .ThenBy(c => c.Company)
                .ThenBy(c => c.NameContact)
                .AsNoTracking()
                .ToListAsync<object>();

            return customers;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for company ID ");
            throw;
        }
    }

    public async Task<List<object>> GetByBranchCust(int branchId, string type)
    {
        try
        {
            if (branchId >= 0)
            {
                return await _context.CustomersByBranch
                    .Where(c => c.IdBranch == branchId
                                && c.Active
                                && c.Type == type)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdBranch,
                        c.NameBranch,
                        c.IdTypecop,
                        c.NameContact,
                        c.Company,
                        c.Rfc,
                        c.Cp,
                        c.City,
                        c.Total,
                        c.Address,
                        c.AddressFiscal,
                        c.State,
                        c.Phone,
                        c.Neighborhood,
                        c.Radio,
                        c.Mobile,
                        c.Email,
                        c.Vigente,
                        c.NumCliente,
                        c.Latitud,
                        c.Longitud,
                        c.Type,
                        c.TypeIntOrExt,
                        c.TypeCustomer,
                        c.FieldContact,
                        c.FieldBank,
                        c.FieldCuenta,
                        c.Active
                    })
                    .OrderByDescending(c => c.Vigente)
                    .ThenBy(c => c.NameBranch)
                    .ThenBy(c => c.NameContact)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            else
            {
                var branches = await _context.Set<ActiveBranchIds>()
                    .Where(x => x.idCompany == -branchId)
                    .ToListAsync();

                // Obtener la lista de branchIds válidos
                var branchIds = branches
                    .SelectMany(b => b.BranchIds.Split(',', StringSplitOptions.RemoveEmptyEntries))
                    .Select(s => int.Parse(s.Trim()))
                    .ToList();

                foreach (var b in branchIds)
                {
                    _logger.LogInformation($"------------------------ BranchId: {b}");
                }

                // Lista final de resultados
                var result = new List<object>();

                // Recorremos cada IdBranch válido
                foreach (var branchIdSelec in branchIds)
                {
                    var customers = await _context.CustomersByBranch
                        .Where(c => c.IdBranch == branchIdSelec
                                    && c.Active
                                    && c.Type == type)
                        .OrderByDescending(c => c.Vigente)
                        .ThenBy(c => c.NameBranch)
                        .ThenBy(c => c.NameContact)
                        .AsNoTracking()
                        .ToListAsync<object>();

                    result.AddRange(customers);
                }

                return result;

            }

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrievin1g Customers for Branch ID {Id}", branchId);
            throw;
        }
    }

    public async Task<List<object>> GetByBranchCompanyCust(int branchId, string Company, string type)
    {
        try
        {
            if (branchId >= 0)
            {
                return await _context.Customers
                    .Where(c => c.IdBranch == branchId
                                && c.Active
                                && c.Company == Company
                                && c.Type == type)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdBranch,
                        c.IdRoot,
                        c.IdTypecop,
                        c.NameContact,
                        c.Company,
                        c.Rfc,
                        c.Cp,
                        c.City,
                        c.Position,
                        c.Total,
                        c.Address,
                        c.AddressFiscal,
                        c.State,
                        c.Phone,
                        c.Neighborhood,
                        c.Radio,
                        c.Mobile,
                        c.Email,
                        c.Vigente,
                        c.NumCliente,
                        c.Latitud,
                        c.Longitud,
                        c.Type,
                        c.TypeIntOrExt,
                        c.TypeCustomer,
                        c.FieldContact,
                        c.FieldBank,
                        c.FieldCuenta,
                        c.Typework,
                        c.Active
                    })
                    //.OrderByDescending(c => c.Id)
                    //.ThenBy(c => c.Vigente)
                    .OrderByDescending(c => c.Vigente)
                    .ThenBy(c => c.IdBranch)
                    .ThenBy(c => c.NameContact)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            else
            {
                List<BranchesApiData> apiData = await _branchesService.GetBranchesData(branchId);
                var result = new List<object>();
                foreach (var branch in apiData)
                {
                    var customers = await _context.Customers
                        .Where(c => c.IdBranch == branch.Id
                                    && c.Active
                                    && c.Type == type)
                        //.OrderByDescending(c => c.Id)
                        //.ThenBy(c => c.Vigente)
                        .OrderByDescending(c => c.Vigente)
                        .ThenBy(c => c.IdBranch)
                        .ThenBy(c => c.NameContact)
                        .AsNoTracking()
                        .ToListAsync<object>();
                    result.AddRange(customers);
                }

                return result;
            }

        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Customers for Branch ID {Id}", branchId);
            throw;
        }
    }

    public async Task<Customer?> GetById(int id)
    {
        try
        {
            return await _context.Customers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == id && c.Active);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Customer with ID {Id}", id);
            throw;
        }
    }

    public async Task<List<object>> GetActiveCustomers(int idBranch, string type)
    {
        try
        {
            return await _context.Customers
                .Where(c => c.Vigente == true
                       && c.IdBranch == idBranch && c.Type == type)
                .Select(c => new
                {
                    name_company = ((c.NameContact ?? "").Trim() +
                                  ((string.IsNullOrWhiteSpace(c.NameContact) || string.IsNullOrWhiteSpace(c.Company)) ? "" : " / ") +
                                  (c.Company ?? "").Trim()).Trim(),
                    active = c.Active,
                    id = c.Id
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving active Customers");
            throw;
        }
    }

    public async Task Save(Customer customer)
    {
        try
        {
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Customer");
            throw;
        }
    }

    public async Task<Customer?> Update(int id, Customer customer)
    {
        var existingCustomer = await _context.Customers.FindAsync(id);
        if (existingCustomer == null)
        {
            _logger.LogWarning("Attempted to update non-existent Customer with ID {Id}", id);
            return null;
        }

        try
        {
            existingCustomer.IdBranch = customer.IdBranch;
            existingCustomer.IdRoot = customer.IdRoot;
            existingCustomer.IdTypecop = customer.IdTypecop;
            existingCustomer.NameContact = customer.NameContact;
            existingCustomer.Company = customer.Company;
            existingCustomer.Rfc = customer.Rfc;
            existingCustomer.City = customer.City;
            existingCustomer.Address = customer.Address;
            existingCustomer.AddressFiscal = customer.AddressFiscal;
            existingCustomer.Cp = customer.Cp;
            existingCustomer.State = customer.State;
            existingCustomer.Neighborhood = customer.Neighborhood;
            existingCustomer.Total = customer.Total;
            existingCustomer.Radio = customer.Radio;
            existingCustomer.Phone = customer.Phone;
            existingCustomer.Position = customer.Position;
            existingCustomer.Mobile = customer.Mobile;
            existingCustomer.Vigente = customer.Vigente;
            existingCustomer.Latitud = customer.Latitud;
            existingCustomer.Longitud = customer.Longitud;
            existingCustomer.TypeCustomer = customer.TypeCustomer;
            existingCustomer.TypeIntOrExt = customer.TypeIntOrExt;
            existingCustomer.Typework = customer.Typework; 
            existingCustomer.Email = customer.Email;
            existingCustomer.FieldContact = customer.FieldContact;
            existingCustomer.FieldBank = customer.FieldBank;
            existingCustomer.FieldCuenta = customer.FieldCuenta;
            existingCustomer.Active = customer.Active;

            await _context.SaveChangesAsync();
            return existingCustomer;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Customer with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingCustomer = await _context.Customers.FindAsync(id);
        if (existingCustomer == null)
        {
            _logger.LogWarning("Attempted to delete non-existent Customer with ID {Id}", id);
            return false;
        }

        try
        {
            existingCustomer.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Customer with ID {Id}", id);
            throw;
        }
    }

    public async Task<List<CombinedData>> GetCombinedData(int idCompany)
    {
        try
        {
            var clientes = await _context.Customerbranchxcatalogs
                .Where(c => c.IdCompany == idCompany)
                .Select(c => new CombinedData
                {
                    CustomerId = c.Id,
                    ApiId = c.Idca,
                    Company = c.Company,
                    NameContact = c.Namecontact,
                    ValueAddition = c.Valueaddition,
                    Cp = c.Cp,
                    //description = c.description,
                    Radio = c.Radio,
                    Latitud = c.Latitud,
                    Longitud = c.Longitud
                })

                .AsNoTracking()
                .ToListAsync();

            return clientes;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener y combinar datos");
            throw;
        }
    }

    private object? GetPropertyValue(object obj, string propertyName)
    {
        if (obj is ExpandoObject expando)
        {
            if (((IDictionary<string, object?>)expando).TryGetValue(propertyName, out object? value))
            {
                return value;
            }
        }
        else
        {
            var property = obj.GetType().GetProperty(propertyName);
            if (property != null)
            {
                return property.GetValue(obj);
            }
        }
        return null;
    }

    public async Task Increment(int id, string type, string operacion)
    {
        if (id <= 0 || string.IsNullOrWhiteSpace(type))
            throw new ArgumentException("Invalid input parameters.");

        try
        {
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == id && c.Active);

            if (customer == null)
            {
                _logger.LogWarning("Customer with ID {Id} not found", id);
                throw new ArgumentException("Customer not found.");
            }
            if (operacion == "SUMA")
            {
                switch (type.ToUpperInvariant())
                {
                    case "CONTACT":
                        customer.FieldContact += 1;
                        break;
                    case "BANK":
                        customer.FieldBank += 1;
                        break;
                    default:
                        _logger.LogWarning("Invalid type '{Type}' provided for Increment.", type);
                        throw new ArgumentException("Invalid increment type.");
                }
            }
            else
            {
                switch (type.ToUpperInvariant())
                {
                    case "CONTACT":
                        customer.FieldContact -= 1;
                        break;
                    case "BANK":
                        customer.FieldBank -= 1;
                        break;
                    default:
                        _logger.LogWarning("Invalid type '{Type}' provided for Increment.", type);
                        throw new ArgumentException("Invalid increment type.");
                }
            }

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Customer");
            throw;
        }
    }



}


public interface ICustomerService
{
    Task<List<object>> GetProvidersByCompany(int idCompany, string Type);
    Task<List<object>> GetByCompanyforPalace(int idCompany);
    Task<List<object>> GetByBranchCust(int branchId, string type);
    Task<List<object>> GetByBranchCompanyCust(int branchId, string Company, string type);
    Task<Customer?> GetById(int id);
    Task<List<object>> GetActiveCustomers(int idBranch, string type);
    Task Save(Customer customer);
    Task<Customer?> Update(int id, Customer customer);
    Task<bool> Delete(int id);
    Task<List<object>> GetByCompany(int idCompany, string Type);
    Task<List<CombinedData>> GetCombinedData(int idCompany);
    Task Increment(int id, string type, string operacion);
}
