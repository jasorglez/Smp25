
// CustomerCreditService.cs
using System.Text.Json;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models.DTOs;
using System.Diagnostics;

namespace MicroServicioTracking.Services.Delison;

public class CustomerCreditDelisonService : ICustomerCreditDelisonService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CustomerCreditDelisonService> _logger;
    private readonly IPaymentsCreditsxCustomersService _paymentsCreditsxCustomersService; // Cambiado a interfaz
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public CustomerCreditDelisonService(
        DbTrackingContext context, 
        ILogger<CustomerCreditDelisonService> logger, 
        IPaymentsCreditsxCustomersService paymentsCreditsxCustomersService, // Cambiado a interfaz
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _paymentsCreditsxCustomersService = paymentsCreditsxCustomersService ?? throw new ArgumentNullException(nameof(paymentsCreditsxCustomersService));
    }

    public async Task<List<object>> GetByCustomer(int customerId)
    {
        try
        {
            _logger.LogWarning("Invalid type '{customerId}' provided for Increment.", customerId);
            var credits = await _context.Cuentasproveedor
                .Where(c => c.IdTabla == customerId && c.Type == "CUENTA    "  && c.Active == true)
                .ToListAsync<object>();
            return credits;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving CustomerCredits for Customer ID {Id}", customerId);
            throw;
        }
    }
    public async Task<Creditxcustomer> Save(Creditxcustomer credit)
    {
        try
        {
            _context.Creditxcustomers.Add(credit);
            await _context.SaveChangesAsync();


            var customer = await _context.Customers.FindAsync(credit.IdCustomer);

            switch (credit.Type)
            {
                case "CUSTOMERS":
                    var totalPending = await _context.Creditxcustomers
                        .Where(c => c.IdCustomer == credit.IdCustomer
                                    && c.Type == "CUSTOMERS"
                                    && c.Active == true)
                        .SumAsync(c => (decimal?)(c.Total - c.Account) ?? 0);

                    // Update customer's total
                    if (customer != null)
                    {
                        customer.Total = totalPending;
                        await _context.SaveChangesAsync();
                    }
                    break;

                case "PROVIDERS":
                    var totalPayments = await _context.Creditxcustomers
                        .Where(c => c.IdCustomer == credit.IdCustomer
                                    && c.Type == "PROVIDERS"
                                    && c.Active == true)
                        .SumAsync(c => (decimal?)(c.Total - c.Account) ?? 0);

                    // Update customer's total
                    if (customer != null)
                    {
                        customer.Total = totalPayments;
                        await _context.SaveChangesAsync();
                    }
                    break;

                default:
                    throw new InvalidOperationException("Invalid credit or payment type.");
            }
            return credit;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving CustomerCredit");
            throw;
        }
    }

    public async Task<Creditxcustomer?> Update(int id, CreditxCustomerDelisonDto customerCreditDto)
    {
        var existingCredit = await _context.Creditxcustomers.FindAsync(id);
        if (existingCredit == null)
        {
            _logger.LogWarning("Attempted to update non-existent Creditxcustomer with ID {Id}", id);
            return null;
        }

        try
        {
            existingCredit.IdCustomer = customerCreditDto.CustomerId;
            existingCredit.IdProveedorXTablas = customerCreditDto.ProveedorXTablasId;
            existingCredit.Date = customerCreditDto.Date;
            existingCredit.Total = customerCreditDto.Total;
            existingCredit.Comments = customerCreditDto.Comments;

            await _context.SaveChangesAsync();

            /*var customer = await _context.Customers.FindAsync(existingCredit.IdCustomer);
            if (customer != null)
            {
                var totalPayments = await _context.Creditxcustomers
                    .Where(c => c.IdCustomer == existingCredit.IdCustomer
                                && c.Type == "PROVIDERS"
                                && c.Active == true)
                    .SumAsync(c => (decimal?)(c.Total - c.Account) ?? 0);

                customer.Total = totalPayments;
                await _context.SaveChangesAsync();
            }*/

            return existingCredit;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Creditxcustomer with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingCredit = await _context.Creditxcustomers.FindAsync(id);
        if (existingCredit == null)
        {
            _logger.LogWarning("Attempted to delete non-existent Creditxcustomer with ID {Id}", id);
            return false;
        }

        // Assuming PaymentsCreditsxCustomers are the details/payments for a credit.
        var payments = await _context.PaymentsCreditsxCustomers.Where(p => p.IdCredit == id && p.Active).AnyAsync();
        if (payments)
        {
            // This is a custom exception defined in CustomerCreditService.cs
            // You might want to define it in a more central place if used by multiple services.
            throw new LoanDeletionException($"No se puede eliminar el abono con ID {id} porque tiene pagos asociados.");
        }

        try
        {
            existingCredit.Active = false; // Soft delete
            await _context.SaveChangesAsync();

            var customer = await _context.Customers.FindAsync(existingCredit.IdCustomer);
            if (customer != null)
            {
                if (existingCredit.Type == "PROVIDERS")
                {
                    var totalPayments = await _context.Creditxcustomers
                        .Where(c => c.IdCustomer == existingCredit.IdCustomer
                                    && c.Type == "PROVIDers"
                                    && c.Active == true)
                        .SumAsync(c => (decimal?)(c.Total - c.Account) ?? 0);

                    customer.Total = totalPayments;
                    await _context.SaveChangesAsync();
                }
            }

            // Recalculate abono for the main provider table
            if (existingCredit.IdProveedorXTablas.HasValue)
            {
                var totalAbono = await _context.Creditxcustomers
                    .Where(c => c.IdProveedorXTablas == existingCredit.IdProveedorXTablas && c.Active == true)
                    .SumAsync(c => c.Total);
                // Here you would call the warehouse service to update the abono on the ProveedorXTabla
                // This part is missing from the provided context but would look something like:
                // await _warehouseService.UpdateAbonoProviderXTable(existingCredit.IdProveedorXTablas.Value, -existingCredit.Total);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Creditxcustomer with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<List<object>> GetByTablaXProveedor(int proveedroId, int tablaId)
    {
        try
        {
            var credits = await _context.Creditxcustomers
                .Where(c => c.IdCustomer == proveedroId && c.IdProveedorXTablas == tablaId && c.Active == true)
                .ToListAsync<object>();
            return credits;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving CustomerCredits for Customer ID");
            throw;
        }
    }

    public async Task<object> UpdateAbono(int id)
    {
        try
        {
            var cuentas = await GetByCustomer(id);
            decimal sumaTotal = 0;

            if (cuentas.Any())
            {
                foreach (var item in cuentas)
                {
                    // Usamos reflexión para obtener el valor de Campo6, ya que el tipo es 'object'
                    var campo6Value = item.GetType().GetProperty("Campo6")?.GetValue(item, null)?.ToString();

                    if (!string.IsNullOrEmpty(campo6Value) && decimal.TryParse(campo6Value, out decimal valor))
                    {
                        sumaTotal += valor;
                    }
                }
            }

            var proveedor = await _context.Customers.FindAsync(id);
            if (proveedor != null)
            {
                // Convertimos la suma a entero para asignarla a FieldCuenta
                proveedor.FieldCuenta = (int)sumaTotal;
                await _context.SaveChangesAsync();
            }

            // Aquí puedes usar la sumaTotal como necesites. Por ahora, la devolveré.
            // También tienes el 'monto' que viene del controlador, por si necesitas usarlo.
            return new { TotalAbono = sumaTotal, ProveedorActualizado = proveedor };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception occurred while calling Warehouse API for UpdateAbono");
            throw;
        }
    }
}

    public interface ICustomerCreditDelisonService
    {
    Task<List<object>> GetByCustomer(int customerId);
    Task<List<object>> GetByTablaXProveedor(int proveedroId, int tablaId);
    Task<Creditxcustomer> Save(Creditxcustomer customerCredit);
    Task<object> UpdateAbono(int id);
    Task<Creditxcustomer?> Update(int id, CreditxCustomerDelisonDto customerCreditDto);
    Task<bool> Delete(int id);
    }
