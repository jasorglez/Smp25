using MicroServicioTracking.Models;
using MicroServicioTracking.Models.View;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class EmployeesXClockService: IEmployeesXClockService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<EmployeesXClockService> _logger;
    private readonly IServiceProvider _serviceProvider;

    public EmployeesXClockService(DbTrackingContext context, ILogger<EmployeesXClockService> logger, IServiceProvider serviceProvider)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
    }

    public async Task<List<object>> ClockByEmployee(int idEmployee)
    {
        try
        {
            return await _context.EmployeesXClocks
                .Where(e => e.IdEmployee == idEmployee && e.Active == true)
                .Select(e => new
                {
                    e.Id,
                    e.IdEmployee,
                    e.Day,
                    e.Enabled,
                    e.Entry1,
                    e.Exit1,
                    e.Entry2,
                    e.Exit2,
                    // En ClockByEmployee y ClockByEmployeeAndDay, reemplazar el cálculo de Hours por:
                    Hours = e.Enabled ? ((e.Exit1.HasValue && e.Entry1.HasValue ? 
                                Convert.ToDecimal((e.Exit1.Value - e.Entry1.Value).TotalHours) : 0m) +
                            (e.Exit2.HasValue && e.Entry2.HasValue ? 
                                Convert.ToDecimal((e.Exit2.Value - e.Entry2.Value).TotalHours) : 0m)) : 0,
                    e.Active
                })
                .OrderBy(e => e.Id)
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }
    
    public async Task<List<object>> ClockByEmployeeAndDay(int idEmployee, string day)
    {
        try
        {
             var days = day.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(d => d.Trim())
                    .ToList();
            return await _context.EmployeesXClocks
                .Where(e => e.IdEmployee == idEmployee && days.Contains(e.Day)  && e.Active == true)
                .Select(e => new
                {
                    e.Id,
                    e.IdEmployee,
                    e.Day,
                    e.Enabled,
                    e.Entry1,
                    e.Exit1,
                    e.Entry2,
                    e.Exit2,
                    // En ClockByEmployee y ClockByEmployeeAndDay, reemplazar el cálculo de Hours por:
                    Hours = e.Enabled ? ((e.Exit1.HasValue && e.Entry1.HasValue ?
                                             Convert.ToDecimal((e.Exit1.Value - e.Entry1.Value).TotalHours) : 0m) +
                                         (e.Exit2.HasValue && e.Entry2.HasValue ?
                                             Convert.ToDecimal((e.Exit2.Value - e.Entry2.Value).TotalHours) : 0m)) : 0,
                    e.Active
                })
                .OrderBy(e => e.Id)
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }
    public async Task<List<object>> ClockByEmployeeByBranch(int idBranch, string day)
    {
        try
        {   if (idBranch >= 0)
            {
                var days = day.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(d => d.Trim())
                    .ToList();

                return await _context.EmployeesClockByBranch
                    .Where(e => days.Contains(e.Day) && e.IdBranch == idBranch && e.Enabled == true)
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBranch,
                        e.IdEmployee,
                        e.Day,
                        e.Enabled,
                        e.Entry1,
                        e.Exit1,
                        e.Entry2,
                        e.Exit2,
                        // En ClockByEmployee y ClockByEmployeeAndDay, reemplazar el cálculo de Hours por:
                        Hours = e.Enabled ? ((e.Exit1.HasValue && e.Entry1.HasValue ?
                                    Convert.ToDecimal((e.Exit1.Value - e.Entry1.Value).TotalHours) : 0m) +
                                (e.Exit2.HasValue && e.Entry2.HasValue ?
                                    Convert.ToDecimal((e.Exit2.Value - e.Entry2.Value).TotalHours) : 0m)) : 0,
                    })
                    .OrderBy(e => e.Id)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            else
            {
                var days = day.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(d => d.Trim())
                    .ToList();

                var branches = await _context.Set<ActiveBranchIds>()
                    .Where(x => x.idCompany == -idBranch)
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
        
                // Consulta completa para todos los branchIds
                var result = await _context.EmployeesClockByBranch
                    .Where(e => days.Contains(e.Day) && e.Enabled && branchIds.Contains(e.IdBranch))
                    .Select(e => new
                    {
                        e.Id,
                        e.IdBranch,
                        e.IdEmployee,
                        e.Day,
                        e.Enabled,
                        e.Entry1,
                        e.Exit1,
                        e.Entry2,
                        e.Exit2,
                        Hours = e.Enabled ? ((e.Entry1.HasValue && e.Exit1.HasValue ?
                                    Convert.ToDecimal((e.Exit1.Value - e.Entry1.Value).TotalHours) : 0m) +
                                (e.Entry2.HasValue && e.Exit2.HasValue ?
                                    Convert.ToDecimal((e.Exit2.Value - e.Entry2.Value).TotalHours) : 0m)) : 0,
                    })
                    .OrderBy(e => e.IdBranch)
                    .AsNoTracking()
                    .ToListAsync<object>();
        
                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }
    
    public async Task Save(EmployeesXClock employeesXClock)
    {
        try
        {
            _context.EmployeesXClocks.Add(employeesXClock);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving info");
            throw;
        }
    }
    
    public async Task<object> Update(int idEmployee, string day, EmployeesXClock employeesXClock)
    {
        try
        {
            var entity = await _context.EmployeesXClocks
                .SingleOrDefaultAsync(e => e.IdEmployee == idEmployee && e.Day == day);
            if (entity == null)
            {
                _logger.LogWarning("Attempted to update non-existent Employee with ID {IdEmployee} and Day {Day}", idEmployee, day);
                return null;
            }

            // Update properties except the primary key
            entity.IdEmployee = employeesXClock.IdEmployee;
            entity.Day = employeesXClock.Day;
            entity.Enabled = employeesXClock.Enabled;
            entity.Entry1 = employeesXClock.Entry1;
            entity.Exit1 = employeesXClock.Exit1;
            entity.Entry2 = employeesXClock.Entry2;
            entity.Exit2 = employeesXClock.Exit2;
            entity.Active = employeesXClock.Active;

            await _context.SaveChangesAsync();
            return entity;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating info");
            throw;
        }
    }

   public async Task<decimal> GetEmployeeTotalHoursByDateRange(DateTime startDate, DateTime endDate, int employeeId)
{
    try
    {
        // Crear un nuevo contexto para evitar concurrencia
        using var scope = _serviceProvider.CreateScope();
        using var context = scope.ServiceProvider.GetRequiredService<DbTrackingContext>();
        
        // Generar lista de días únicos de la semana en el rango
        var daysOfWeek = new HashSet<string>();
        for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
        {
            var dayOfWeek = date.ToString("dddd", new System.Globalization.CultureInfo("es-ES"));
            daysOfWeek.Add(dayOfWeek);
        }

        // Hacer consulta directa con contexto nuevo
        var days = daysOfWeek.ToList();
        var clockData = await context.EmployeesXClocks
            .Where(e => e.IdEmployee == employeeId && days.Contains(e.Day) && e.Active == true)
            .Select(e => new
            {
                e.Id,
                e.IdEmployee,
                e.Day,
                e.Enabled,
                e.Entry1,
                e.Exit1,
                e.Entry2,
                e.Exit2,
                Hours = e.Enabled ? ((e.Exit1.HasValue && e.Entry1.HasValue ?
                                         Convert.ToDecimal((e.Exit1.Value - e.Entry1.Value).TotalHours) : 0m) +
                                     (e.Exit2.HasValue && e.Entry2.HasValue ?
                                         Convert.ToDecimal((e.Exit2.Value - e.Entry2.Value).TotalHours) : 0m)) : 0,
                e.Active
            })
            .AsNoTracking()
            .ToListAsync();
        
        // Calcular total de días en el rango
        var totalDaysInRange = (endDate.Date - startDate.Date).Days + 1;
        
        // Calcular horas por día de la semana
        var totalWeeklyHours = clockData.Sum(c => c.Hours);
        
        // Calcular proporción basada en días reales vs días de la semana
        var weeksInRange = totalDaysInRange / 7.0;
        var adjustedHours = totalWeeklyHours * (decimal)weeksInRange;
        
        return Math.Round(adjustedHours, 2);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error retrieving total hours for employee ID {EmployeeId} between {StartDate} and {EndDate}",
            employeeId, startDate, endDate);
        throw;
    }
}

}

public interface IEmployeesXClockService
{
    Task<List<object>> ClockByEmployee(int idEmployee);
    Task<List<object>> ClockByEmployeeAndDay(int idEmployee, string day);
    Task<List<object>> ClockByEmployeeByBranch(int idBranch, string day);
    Task Save(EmployeesXClock employeesXClock);
    Task<object> Update(int idEmployee, string day, EmployeesXClock employeesXClock);
    Task<decimal> GetEmployeeTotalHoursByDateRange(DateTime startDate, DateTime endDate, int employeeId);
}