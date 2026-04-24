using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class ConceptsxLoansCreditService : IConceptsxLoansCreditsService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<ConceptsxLoansCreditService> _logger;

    public ConceptsxLoansCreditService(DbTrackingContext context, ILogger<ConceptsxLoansCreditService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public class InvalidConceptPaymentException : Exception
    {
        public InvalidConceptPaymentException(string message) : base(message) { }
    }

    // ... (Other methods: GetById, GetAll, etc. - implement as needed)

    public async Task<List<ConceptsxLoansCredit>> GetByLoanAndCreditId(int idLoanAndCredit)
    {
        try
        {
            return await _context.ConceptsxLoansCredits
                .Where(c => c.IdLoanAndCredit == idLoanAndCredit && c.Active)
                .OrderByDescending(c => c.Date)
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting concepts by LoanAndCredit ID: {idLoanAndCredit}", idLoanAndCredit);
            throw;
        }
    }

    public async Task Save(ConceptsxLoansCredit concept)
    {
        try
        {
            // Obtén el préstamo/ahorro actual
            var loanAndCredit = await _context.Loanandcredits
                .Where(lc => lc.Id == concept.IdLoanAndCredit && lc.Active)
                .FirstOrDefaultAsync();

            if (loanAndCredit == null)
                throw new InvalidOperationException("No existe el préstamo o ahorro.");
    
            // // Validar que la fecha del concepto no sea anterior a la fecha del préstamo
            if (concept.Date < loanAndCredit.Date)
                 throw new InvalidConceptPaymentException(
                     $"La fecha del pago no puede ser anterior a la fecha del {loanAndCredit.Type.ToLower()} ({loanAndCredit.Date:dd/MM/yyyy})");

            // Suma de pagos actuales activos
            var currentPayments = await _context.ConceptsxLoansCredits
                .Where(c => c.IdLoanAndCredit == concept.IdLoanAndCredit && c.Active)
                .SumAsync(c => c.Total);

            var newTotalPayments = currentPayments + concept.Total;
            var monto = loanAndCredit.Monto ?? 0;

            if (loanAndCredit.Type == "AHORRO")
            {
                // No permitir retirar más de lo disponible
                if (newTotalPayments > monto)
                    throw new InvalidConceptPaymentException("No puede retirar más de lo que tiene en ahorro.");
            }
            else if (loanAndCredit.Type == "PRESTAMO")
            {
                // No permitir abonar más de lo que debe
                if (newTotalPayments > monto)
                    throw new InvalidConceptPaymentException("No puede abonar más de lo que debe en el préstamo.");
            }

            // Si pasa la validación, guardar normalmente
            _context.ConceptsxLoansCredits.Add(concept);
            await _context.SaveChangesAsync();

            // Actualizar payments y employee
            loanAndCredit.Payments = newTotalPayments;
            await _context.SaveChangesAsync();

            var employee = await _context.Employees.FindAsync(loanAndCredit.IdEmpleado);
            if (employee != null)
            {
                if (loanAndCredit.Type == "PRESTAMO")
                {
                    var loanSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && lc.Type == "PRESTAMO" && lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Loan = loanSum;
                }
                else if (loanAndCredit.Type == "AHORRO")
                {
                    var savingSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && lc.Type == "AHORRO" && lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Saving = savingSum;
                }
                await _context.SaveChangesAsync();
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving concept");
            throw;
        }
    }

    public async Task<ConceptsxLoansCredit?> Update(int id, ConceptsxLoansCredit concept)
    {
        var existingConcept = await _context.ConceptsxLoansCredits.FindAsync(id);
        if (existingConcept == null)
        {
            _logger.LogWarning("Concept not found with ID: {id}", id);
            return null;
        }

        try
        {
            var loanAndCredit = await _context.Loanandcredits
                .Where(lc => lc.Id == concept.IdLoanAndCredit && lc.Active)
                .FirstOrDefaultAsync();

            if (loanAndCredit == null)
                throw new InvalidOperationException("No existe el préstamo o ahorro.");

            // Suma de pagos actuales activos excluyendo el concepto actual
            var currentPayments = await _context.ConceptsxLoansCredits
                .Where(c => c.IdLoanAndCredit == concept.IdLoanAndCredit 
                           && c.Active 
                           && c.Id != id)
                .SumAsync(c => c.Total);

            var newTotalPayments = currentPayments + concept.Total;
            var monto = loanAndCredit.Monto ?? 0;

            if (loanAndCredit.Type == "AHORRO")
            {
                if (newTotalPayments > monto)
                    throw new InvalidConceptPaymentException("No puede retirar más de lo que tiene en ahorro.");
            }
            else if (loanAndCredit.Type == "PRESTAMO")
            {
                if (newTotalPayments > monto)
                    throw new InvalidConceptPaymentException("No puede abonar más de lo que debe en el préstamo.");
            }

            existingConcept.IdLoanAndCredit = concept.IdLoanAndCredit;
            existingConcept.Date = concept.Date;
            existingConcept.Total = concept.Total;
            existingConcept.Status = concept.Status;
            existingConcept.Comments = concept.Comments;
            existingConcept.Active = concept.Active;

            await _context.SaveChangesAsync();

            // Actualizar payments
            loanAndCredit.Payments = newTotalPayments;
            await _context.SaveChangesAsync();

            // Actualizar employee
            var employee = await _context.Employees.FindAsync(loanAndCredit.IdEmpleado);
            if (employee != null)
            {
                if (loanAndCredit.Type == "PRESTAMO")
                {
                    var loanSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && lc.Type == "PRESTAMO" && lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Loan = loanSum;
                }
                else if (loanAndCredit.Type == "AHORRO")
                {
                    var savingSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && lc.Type == "AHORRO" && lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Saving = savingSum;
                }
                await _context.SaveChangesAsync();
            }

            return existingConcept;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating concept {id}", id);
            throw;
        }
    }


    public async Task<bool> Delete(int id)
    {
        var concept = await _context.ConceptsxLoansCredits.FindAsync(id);
        if (concept == null)
        {
            _logger.LogWarning("Concept not found with ID: {id}", id);
            return false;
        }

        try
        {
            var loanAndCredit = await _context.Loanandcredits
                .Where(lc => lc.Id == concept.IdLoanAndCredit && lc.Active)
                .FirstOrDefaultAsync();

            if (loanAndCredit == null)
                throw new InvalidOperationException("No existe el préstamo o ahorro.");

            // Desactivar el concepto (soft delete)
            concept.Active = false;
            await _context.SaveChangesAsync();

            // Recalcular la suma de pagos activos
            var currentPayments = await _context.ConceptsxLoansCredits
                .Where(c => c.IdLoanAndCredit == concept.IdLoanAndCredit && c.Active)
                .SumAsync(c => c.Total);

            // Actualizar payments en el préstamo/ahorro
            loanAndCredit.Payments = currentPayments;
            await _context.SaveChangesAsync();

            // Actualizar el valor de loans o savings en employees
            var employee = await _context.Employees.FindAsync(loanAndCredit.IdEmpleado);
            if (employee != null)
            {
                if (loanAndCredit.Type == "PRESTAMO")
                {
                    var loanSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && 
                                    lc.Type == "PRESTAMO" && 
                                    lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Loan = loanSum;
                }
                else if (loanAndCredit.Type == "AHORRO")
                {
                    var savingSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanAndCredit.IdEmpleado && 
                                    lc.Type == "AHORRO" && 
                                    lc.Active)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                    employee.Saving = savingSum;
                }
                await _context.SaveChangesAsync();
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

public interface IConceptsxLoansCreditsService
{
    Task<List<ConceptsxLoansCredit>> GetByLoanAndCreditId(int idLoanAndCredit);
    Task Save(ConceptsxLoansCredit concept);
    Task<ConceptsxLoansCredit?> Update(int id, ConceptsxLoansCredit concept);
    Task<bool> Delete(int id);
}