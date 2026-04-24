using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class EmployeesxLoansService: IEmployeesxLoansService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<EmployeesxLoansService> _logger;
    
    public EmployeesxLoansService(DbTrackingContext context, ILogger<EmployeesxLoansService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<EmployeesxLoans>> LoansByEmployee(int idEmployee)
    {
        try
        {
            return await _context.EmployeesxLoans
                .Where(e => e.IdEmployee == idEmployee)
                .OrderByDescending(e => e.Date)
                .Select(e => new EmployeesxLoans
                {
                    Id = e.Id,
                    IdEmployee = e.IdEmployee,
                    Date = e.Date,
                    Loan = e.Loan,
                    Payment = e.Payment,
                    Total = e.Total,
                    Status = e.Status,
                    Comments = e.Comments,
                    Active = e.Active,
                    // Si Saldo es una propiedad de EmployeesxLoans:
                    Saldo = _context.EmployeesxLoans
                        .Where(x => x.IdEmployee == e.IdEmployee && x.Date <= e.Date)
                        .Select(x => (decimal?)(x.Loan - x.Payment))
                        .Sum() ?? 0
                })
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Loans for Employee {IdEmployee}", idEmployee);
            throw;
        }
    }

    public async Task Save(EmployeesxLoans employeesxLoans)
    {
        try
        {
            _context.EmployeesxLoans.Add(employeesxLoans);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Employee");
            throw;
        }
    }

    public async Task<EmployeesxLoans?> Update(int id, EmployeesxLoans employeesxLoans)
    {
        var existingEmployeexLoan = await _context.EmployeesxLoans.FindAsync(id);
        if (existingEmployeexLoan == null)
        {
            _logger.LogWarning("Attempted to update non-existent Employee with ID {Id}", id);
            return null;
        }

        try
        {
            existingEmployeexLoan.IdEmployee = employeesxLoans.IdEmployee;
            existingEmployeexLoan.Date = employeesxLoans.Date;
            existingEmployeexLoan.Loan = employeesxLoans.Loan;
            existingEmployeexLoan.Payment = employeesxLoans.Payment;
            existingEmployeexLoan.Comments = employeesxLoans.Comments;
            existingEmployeexLoan.Active = employeesxLoans.Active;

            await _context.SaveChangesAsync();
            return existingEmployeexLoan;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Employee x Loan with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingEmployeexLoan = await _context.EmployeesxLoans.FindAsync(id);
        if (existingEmployeexLoan == null)
        {
            _logger.LogWarning("Attempted to delete non-existent Employee x Loan with ID {Id}", id);
            return false;
        }

        try
        {
            existingEmployeexLoan.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Employee x Loan with ID {Id}", id);
            throw;
        }
    }

}

public interface IEmployeesxLoansService
{
    Task<List<EmployeesxLoans>> LoansByEmployee(int idEmployee);
    Task Save(EmployeesxLoans employeesxLoans);
    Task<EmployeesxLoans?> Update(int id, EmployeesxLoans employeesxLoans);
    Task<bool> Delete(int id);
}

