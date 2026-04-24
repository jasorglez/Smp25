using MicroServicioTracking.Models;
using MicroServicioTracking.Models.View;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class EmployeeCheckInOutSummaryService: IEmployeeCheckInOutSummaryService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<EmployeeCheckInOutSummaryService> _logger;
    
    public EmployeeCheckInOutSummaryService(DbTrackingContext context, ILogger<EmployeeCheckInOutSummaryService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<List<EmployeeCheckInOutSummaryView>> GetEmployeeCheckInOutSummary(int idEmployee, DateTime startDate, DateTime endDate)
    {
        try
        {
            var query = _context.EmployeeCheckInOutSummaryViews
                .Where(x => x.IdEmployee == idEmployee && x.Date >= startDate && x.Date <= endDate)
                .OrderByDescending(x => x.Date)
                .ToListAsync();

            return await query;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener el resumen de entradas y salidas de empleados");
            throw;
        }
    }
}

public interface IEmployeeCheckInOutSummaryService
{
    Task<List<EmployeeCheckInOutSummaryView>> GetEmployeeCheckInOutSummary(int idBranch, DateTime startDate,
        DateTime endDate);
}