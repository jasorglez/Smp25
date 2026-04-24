using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class PaymentsCreditsxCustomersService: IPaymentsCreditsxCustomersService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<PaymentsCreditsxCustomersService> _logger;

    public PaymentsCreditsxCustomersService(DbTrackingContext context, ILogger<PaymentsCreditsxCustomersService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<PaymentsCreditsxCustomers>> GetByCredit(int id)
    {
        try
        {
            return await _context.PaymentsCreditsxCustomers
                .Where(p => p.IdCredit == id && p.Active)
                .OrderByDescending(p => p.DatePayment)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting payments by ID {Id}", id);
            throw;
        }
    }
    
    public class PaymentExceedsRemainingBalanceException : Exception
    {
        public PaymentExceedsRemainingBalanceException(decimal payment, decimal? remaining)
            : base($"El pago de {payment:C2} excede el saldo restante de {remaining:C2}")
        {
        }
    }

    public async Task Save(PaymentsCreditsxCustomers concept)
{
    try
    {
        // Primero verificamos el saldo restante
        var creditxcustomer = await _context.Creditxcustomers
            .Where(lc => lc.Id == concept.IdCredit && lc.Active == true)
            .FirstOrDefaultAsync();

        if (creditxcustomer == null)
        {
            throw new InvalidOperationException("No se encontró el crédito especificado");
        }

        var remainingBalance = creditxcustomer.Total - (creditxcustomer.Account ?? 0);
        if (concept.Amount > remainingBalance)
        {
            throw new PaymentExceedsRemainingBalanceException(concept.Amount, remainingBalance);
        }

        // El resto del código original del método Save
        _context.PaymentsCreditsxCustomers.Add(concept);
        await _context.SaveChangesAsync();

        // Actualizar los pagos usando LINQ
        creditxcustomer.Account = await _context.PaymentsCreditsxCustomers
            .Where(c => c.IdCredit == concept.IdCredit && c.Active == true)
            .SumAsync(c => c.Amount);

        await _context.SaveChangesAsync();
        var customer = await _context.Customers.FindAsync(creditxcustomer.IdCustomer);

        // Actualizar el total del cliente
        if (customer != null)
        {
            if (creditxcustomer.Type == "CUSTOMERS")
            {
                customer.Total = await _context.Creditxcustomers
                    .Where(c => c.IdCustomer == creditxcustomer.IdCustomer
                                && c.Type == "CUSTOMERS"
                                && c.Active == true)
                    .SumAsync(c => (c.Total ?? 0) - (c.Account ?? 0));
            }
            else if (creditxcustomer.Type == "PROVIDERS")
            {
                customer.Total = await _context.Creditxcustomers
                    .Where(c => c.IdCustomer == creditxcustomer.IdCustomer
                                && c.Type == "PROVIDERS"
                                && c.Active == true)
                    .SumAsync(c => (c.Total ?? 0) - (c.Account ?? 0));
            }
            await _context.SaveChangesAsync();
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al guardar el pago");
        throw;
    }
}
    
    public async Task<PaymentsCreditsxCustomers?> Update(int id, PaymentsCreditsxCustomers payment)
    {
        var existingPaymentCredit = await _context.PaymentsCreditsxCustomers.FindAsync(id);
        if (existingPaymentCredit == null)
        {
            _logger.LogWarning("Attempted to update non-existent Loan with ID {Id}", id);
            return null;
        }

        try
        {
            // Obtener el crédito
            var creditxcustomer = await _context.Creditxcustomers
                .Where(lc => lc.Id == payment.IdCredit && lc.Active == true)
                .FirstOrDefaultAsync();

            if (creditxcustomer == null)
            {
                throw new InvalidOperationException("No se encontró el crédito especificado");
            }

            // Calcular la suma de todos los pagos excluyendo el pago actual
            var totalOtherPayments = await _context.PaymentsCreditsxCustomers
                .Where(c => c.IdCredit == payment.IdCredit 
                        && c.Active == true 
                        && c.Id != id)
                .SumAsync(c => c.Amount);

            // Verificar si el nuevo total excedería el límite
            if (totalOtherPayments + payment.Amount > creditxcustomer.Total)
            {
                throw new PaymentExceedsRemainingBalanceException(
                    totalOtherPayments + payment.Amount, 
                    creditxcustomer.Total);
            }

            // Actualizar el pago
            existingPaymentCredit.IdCredit = payment.IdCredit;
            existingPaymentCredit.Amount = payment.Amount;
            existingPaymentCredit.DatePayment = payment.DatePayment;
            existingPaymentCredit.Comments = payment.Comments;
            existingPaymentCredit.Active      = payment.Active; // Important: Update the Active status

            await _context.SaveChangesAsync();

            // Actualizar Account en creditxcustomer
            creditxcustomer.Account = await _context.PaymentsCreditsxCustomers
                .Where(c => c.IdCredit == existingPaymentCredit.IdCredit && c.Active == true)
                .SumAsync(c => c.Amount);
            
            await _context.SaveChangesAsync();

            return existingPaymentCredit;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Loan with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<bool> Delete(int id)
    {
        var concept = await _context.PaymentsCreditsxCustomers.FindAsync(id);
        if (concept == null)
        {
            _logger.LogWarning("Concept not found with ID: {id}", id);
            return false;
        }

        try
        {
            concept.Active = false; // Soft delete
            await _context.SaveChangesAsync();
            
            // Actualizar los pagos usando LINQ
            var creditxcustomer = await _context.Creditxcustomers
                .Where(lc => lc.Id == concept.IdCredit && lc.Active == true)
                .FirstOrDefaultAsync();

            if (creditxcustomer != null)
            {
                creditxcustomer.Account = await _context.PaymentsCreditsxCustomers
                    .Where(c => c.IdCredit == concept.IdCredit && c.Active == true)
                    .SumAsync(c => c.Amount);

                await _context.SaveChangesAsync();
                var customer = await _context.Customers.FindAsync(creditxcustomer.IdCustomer);
                
                // Actualizar el total del cliente
                if (customer != null)
                {
                    // Calcular la suma de todos los saldos pendientes del cliente
                    if (creditxcustomer.Type == "CUSTOMERS")
                    {
                        customer.Total = await _context.Creditxcustomers
                            .Where(c => c.IdCustomer == creditxcustomer.IdCustomer 
                                        && c.Type == "CUSTOMERS" 
                                        && c.Active == true)
                            .SumAsync(c => (c.Total ?? 0) - (c.Account ?? 0));
                    }
                    else if (creditxcustomer.Type == "PROVIDERS")
                    {
                        customer.Total = await _context.Creditxcustomers
                            .Where(c => c.IdCustomer == creditxcustomer.IdCustomer 
                                        && c.Type == "PROVIDERS" 
                                        && c.Active == true)
                            .SumAsync(c => (c.Total ?? 0) - (c.Account ?? 0));
                    }
                    await _context.SaveChangesAsync();
                }
            }
            
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting concept {id}", id);
            throw;
        }
    }
}

public interface IPaymentsCreditsxCustomersService
{
    Task<List<PaymentsCreditsxCustomers>> GetByCredit(int id);
    Task Save(PaymentsCreditsxCustomers concept);
    Task<PaymentsCreditsxCustomers?> Update(int id, PaymentsCreditsxCustomers payment);
    Task<bool> Delete(int id);
}