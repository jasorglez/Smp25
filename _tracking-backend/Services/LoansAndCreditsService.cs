

using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging; // Make sure you have this using statement


namespace MicroServicioTracking.Services;

public class InsufficientFundsException : Exception
{
    public InsufficientFundsException(string message) : base(message) { }
}

public class LoanDeletionException : Exception
{
    public LoanDeletionException(string message) : base(message) { }
}

public class LoansAndCreditsService : ILoansAndCreditsService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<LoansAndCreditsService> _logger;
    private readonly IConceptsxLoansCreditsService _conceptsxLoansCreditsService;
    private readonly IGetBranchesByCompanyService _branchesService;

    public LoansAndCreditsService(DbTrackingContext context, ILogger<LoansAndCreditsService> logger, IConceptsxLoansCreditsService conceptsxLoansCreditsService, IGetBranchesByCompanyService branchesService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _conceptsxLoansCreditsService = conceptsxLoansCreditsService ?? throw new ArgumentNullException(nameof(conceptsxLoansCreditsService));
        _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
    }

    public async Task<List<Loanandcredit>> LoansByEmployee(int idEmployee,string Type)
    {
        try
        {
            return await _context.Loanandcredits
                .Where(el => el.IdEmpleado == idEmployee && el.Type==Type && el.Active == true)
                .OrderByDescending(el => el.Id).ThenByDescending(el => el.Date)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Loans for Employee {IdEmployee}", idEmployee);
            throw; // Re-throw the exception after logging
        }
    }

    public async Task<Loanandcredit> Save(Loanandcredit loanandcredit)
{
    try
    {
        _context.Loanandcredits.Add(loanandcredit);
        await _context.SaveChangesAsync();

        var employee = await _context.Employees.FindAsync(loanandcredit.IdEmpleado);
        switch (loanandcredit.Type)
        {
            case "PRESTAMO":
            {
                var loanSum = await _context.Loanandcredits
                    .Where(lc => lc.IdEmpleado == loanandcredit.IdEmpleado && lc.Type == "PRESTAMO" && lc.Active == true)
                    .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;

                if (employee != null)
                {
                    employee.Loan = loanSum;
                    await _context.SaveChangesAsync();
                }

                return loanandcredit;
            }
            case "AHORRO":
            {
                var savingSum = await _context.Loanandcredits
                    .Where(lc => lc.IdEmpleado == loanandcredit.IdEmpleado && lc.Type == "AHORRO" && lc.Active == true)
                    .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                
                if (employee != null)
                {
                    employee.Saving = savingSum;
                    await _context.SaveChangesAsync();
                }

                return loanandcredit;
            }
            default:
                throw new InvalidOperationException("Invalid loan type.");
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error saving Loan");
        throw;
    }
}
    //aqui la suma en la tabla empleados
    public async Task<Loanandcredit?> Update(int id, Loanandcredit loanandcredit)
    {
        var existingLoan = await _context.Loanandcredits.FindAsync(id);
        if (existingLoan == null)
        {
            _logger.LogWarning("Attempted to update non-existent Loan with ID {Id}", id);
            return null;
        }

        try
        {
            existingLoan.IdEmpleado = loanandcredit.IdEmpleado;
            existingLoan.Monto      = loanandcredit.Monto;
            existingLoan.Date       = loanandcredit.Date;
            existingLoan.Type       = loanandcredit.Type;
            existingLoan.Comments   = loanandcredit.Comments;
            existingLoan.Active     = loanandcredit.Active; // Important: Update the Active status

            await _context.SaveChangesAsync();
            
            var employee = await _context.Employees.FindAsync(loanandcredit.IdEmpleado);
            switch (existingLoan.Type)
            {
                case "PRESTAMO":
                {
                    var loanSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanandcredit.IdEmpleado && lc.Type == "PRESTAMO" && lc.Active == true)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;

                    if (employee != null)
                    {
                        employee.Loan = loanSum;
                        await _context.SaveChangesAsync();
                    }

                    break;
                }
                case "AHORRO":
                {
                    var savingSum = await _context.Loanandcredits
                        .Where(lc => lc.IdEmpleado == loanandcredit.IdEmpleado && lc.Type == "AHORRO" && lc.Active == true)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;
                
                    if (employee != null)
                    {
                        employee.Saving = savingSum;
                        await _context.SaveChangesAsync();
                    }

                    break;
                }
                default:
                    throw new InvalidOperationException("Invalid loan type.");
            }
            return existingLoan;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Loan with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingLoan = await _context.Loanandcredits.FindAsync(id);
        if (existingLoan == null)
        {
            throw new LoanDeletionException($"No se encontró el préstamo con ID {id}");
        }

        var concepts = await _conceptsxLoansCreditsService.GetByLoanAndCreditId(id);
        if (concepts.Any())
        {
            throw new LoanDeletionException($"No se puede eliminar el préstamo con ID {id} porque tiene conceptos asociados");
        }
        
        try
        {
            existingLoan.Active = false; // Soft delete by setting Active to false
            await _context.SaveChangesAsync();
            
            var employee = await _context.Employees.FindAsync(existingLoan.IdEmpleado);

            switch (existingLoan.Type)
            {
                case "PRESTAMO":
                {
                    var loanSum = await _context.Loanandcredits
                        .Where(lc =>
                            lc.IdEmpleado == existingLoan.IdEmpleado && lc.Type == "PRESTAMO" && lc.Active == true)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;

                    if (employee != null)
                    {
                        employee.Loan = loanSum;
                    }

                    break;

                }
                case "AHORRO":
                {
                    var savingSum = await _context.Loanandcredits
                        .Where(lc =>
                            lc.IdEmpleado == existingLoan.IdEmpleado && lc.Type == "AHORRO" && lc.Active == true)
                        .SumAsync(lc => (decimal?)(lc.Monto - lc.Payments)) ?? 0;

                    if (employee != null)
                    {
                        employee.Saving = savingSum;
                    }

                    break;

                }
            }
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Loan with ID {Id}", id);
            throw;
        }
    }
    
    public async Task<List<object>> GetSavingsWithEmployeeNames(int idBranch)
    {
        try
        {
            if (idBranch >= 0)
            {
                var result = await (from loan in _context.Loanandcredits
                    join emp in _context.Employees on loan.IdEmpleado equals emp.Id
                    where (loan.Type == "AHORRO")
                          && loan.Active == true
                          && emp.IdBranch == idBranch
                    select new
                    {
                        loan.Id,
                        EmployeeName = emp.Name,
                        loan.Type,
                        loan.Monto,
                        loan.Payments,
                        loan.Comments,
                        loan.Remain,
                        loan.Date,
                        loan.Active
                    })
                    .OrderByDescending(loan => loan.Id)
                    .ThenByDescending(loan => loan.Date)
                    .ToListAsync();

                return result.Cast<object>().ToList();
            }
            else
            {
                var branches = await _branchesService.GetBranchesData(-idBranch);
                var result = new List<object>();

                foreach (var branch in branches)
                {
                    var loans = await (from loan in _context.Loanandcredits
                        join emp in _context.Employees on loan.IdEmpleado equals emp.Id
                        where (loan.Type == "AHORRO")
                              && loan.Active == true
                              && emp.IdBranch == branch.Id // Corregido para usar branch.Id
                        select new
                        {
                            loan.Id,
                            EmployeeName = emp.Name,
                            loan.Type,
                            loan.Monto,
                            loan.Payments,
                            loan.Comments,
                            loan.Remain,
                            loan.Date,
                            loan.Active
                        }).OrderByDescending(loan => loan.Id).ThenByDescending(loan => loan.Date).ToListAsync();
                    result.AddRange(loans.Cast<object>());
                }

                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving savings with employee names");
            throw;
        }
    }

    public async Task<List<object>> GetLoansWithEmployeeNames(int idBranch)
    {
        try
        {
            if (idBranch >= 0)
            {
                var result = await (from loan in _context.Loanandcredits
                    join emp in _context.Employees on loan.IdEmpleado equals emp.Id
                    where (loan.Type == "PRESTAMO")
                          && loan.Active == true
                          && emp.IdBranch == idBranch
                    select new
                    {
                        loan.Id,
                        EmployeeName = emp.Name,
                        loan.Type,
                        loan.Monto,
                        loan.Payments,
                        loan.Comments,
                        loan.Remain,
                        loan.Date,
                        loan.Active
                    })
                    .OrderByDescending(loan => loan.Id)
                    .ThenByDescending(loan => loan.Date)
                    .ToListAsync();

                return result.Cast<object>().ToList();
            }
            else
            {
                var branches = await _branchesService.GetBranchesData(-idBranch);
                var result = new List<object>();

                foreach (var branch in branches)
                {
                    var loans = await (from loan in _context.Loanandcredits
                        join emp in _context.Employees on loan.IdEmpleado equals emp.Id
                        where (loan.Type == "PRESTAMO")
                              && loan.Active == true
                              && emp.IdBranch == branch.Id // Corregido para usar branch.Id
                        select new
                        {
                            loan.Id,
                            EmployeeName = emp.Name,
                            loan.Type,
                            loan.Monto,
                            loan.Payments,
                            loan.Remain,
                            loan.Date,
                            loan.Active,
                            loan.Comments
                        }).OrderByDescending(loan => loan.Id).ThenByDescending(loan => loan.Date).ToListAsync();
                    result.AddRange(loans.Cast<object>());
                }

                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving loans with employee names");
            throw;
        }
    }
}

public interface ILoansAndCreditsService
{
    Task<List<Loanandcredit>> LoansByEmployee(int idEmployee, string Type);
    Task<Loanandcredit> Save(Loanandcredit loanandcredit);
    Task<Loanandcredit?> Update(int id, Loanandcredit loanandcredit);
    Task<bool> Delete(int id);
    Task<List<object>> GetLoansWithEmployeeNames(int idBranch);
    Task<List<object>> GetSavingsWithEmployeeNames(int idBranch);
}

