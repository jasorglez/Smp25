
// CustomerCreditService.cs
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.EntityFrameworkCore;

public class LoanDeletionException : Exception
{
    public LoanDeletionException(string message) : base(message) { }
}
public class CustomerCreditService : ICustomerCreditService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CustomerCreditService> _logger;
    private readonly IPaymentsCreditsxCustomersService _paymentsCreditsxCustomersService; // Cambiado a interfaz

    public CustomerCreditService(
        DbTrackingContext context, 
        ILogger<CustomerCreditService> logger, 
        IPaymentsCreditsxCustomersService paymentsCreditsxCustomersService) // Cambiado a interfaz
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _paymentsCreditsxCustomersService = paymentsCreditsxCustomersService ?? throw new ArgumentNullException(nameof(paymentsCreditsxCustomersService));
    }

    public async Task<List<object>> GetByCustomer(int customerId)
    {
        try
        {
            return await _context.Creditxcustomers
                .Where(c => c.IdCustomer == customerId && c.Active == true)
                .Select(c => new
                {
                    c.Id,
                    c.IdCustomer,
                    c.NumberNote,
                    c.Date,
                    c.Account,
                    c.Total,
                    c.Remain,
                    c.Type,
                    c.Active
                })
                .OrderByDescending(c => c.Id )
                .AsNoTracking()
                .ToListAsync<object>();
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

    public async Task<Creditxcustomer?> Update(int id, Creditxcustomer customerCredit)
    {
        var existingCredit = await _context.Creditxcustomers.FindAsync(id);
        if (existingCredit == null)
        {
            _logger.LogWarning("Attempted to update non-existent CustomerCredit with ID {Id}", id);
            return null;
        }

        try
        {
            existingCredit.IdCustomer = customerCredit.IdCustomer;
            existingCredit.NumberNote = customerCredit.NumberNote;
            existingCredit.Date = customerCredit.Date;    
            existingCredit.Total = customerCredit.Total;
            existingCredit.Account = customerCredit.Account;
            existingCredit.Type = customerCredit.Type;
            existingCredit.Active = customerCredit.Active;

            await _context.SaveChangesAsync();
            var customer = await _context.Customers.FindAsync(existingCredit.IdCustomer);
            switch (existingCredit.Type)
            {
                case "CUSTOMERS":
                    var totalPending = await _context.Creditxcustomers
                        .Where(c => c.IdCustomer == existingCredit.IdCustomer 
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
                        .Where(c => c.IdCustomer == existingCredit.IdCustomer 
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
            return existingCredit;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating CustomerCredit with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingCredit = await _context.Creditxcustomers.FindAsync(id);
        if (existingCredit == null)
        {
            _logger.LogWarning("Attempted to delete non-existent CustomerCredit with ID {Id}", id);
            return false;
        }
        
        var concepts = await _paymentsCreditsxCustomersService.GetByCredit(id);
        if (concepts.Any())
        {
            throw new LoanDeletionException($"No se puede eliminar la nota con ID {id} porque tiene conceptos asociados");
        }

        try
        {
            existingCredit.Active = false;
            await _context.SaveChangesAsync();
            var customer = await _context.Customers.FindAsync(existingCredit.IdCustomer);
            switch (existingCredit.Type)
            {
                case "CUSTOMERS":
                    var totalPending = await _context.Creditxcustomers
                        .Where(c => c.IdCustomer == existingCredit.IdCustomer 
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
                        .Where(c => c.IdCustomer == existingCredit.IdCustomer 
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
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting CustomerCredit with ID {Id}", id);
            throw;
        }
    }
}

    public interface ICustomerCreditService
    {
        Task<List<object>> GetByCustomer(int customerId);
        Task<Creditxcustomer> Save(Creditxcustomer customerCredit);
        Task<Creditxcustomer?> Update(int id, Creditxcustomer customerCredit);
        Task<bool> Delete(int id);
    }
