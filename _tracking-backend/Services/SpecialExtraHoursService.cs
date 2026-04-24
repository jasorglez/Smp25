using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class SpecialExtraHoursService: ISpecialExtraHoursService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<SpecialExtraHoursService> _logger;

    public SpecialExtraHoursService(DbTrackingContext context, ILogger<SpecialExtraHoursService> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }

    public async Task<List<dynamic>> GetSpecialExtraHours(int idEmployee, DateTime startDate, DateTime endDate)
    {
        try
        {
            var adjustedEndDate = endDate.AddDays(1);

            return await _context.SpecialExtraHours
                .Where(sp => sp.IdEmployee == idEmployee &&
                             sp.Active &&
                             sp.StartDate >= startDate &&
                             sp.StartDate < adjustedEndDate)
                .Select(sp => new
                {
                    sp.Id,
                    sp.IdEmployee,
                    sp.StartDate,
                    sp.EndDate,
                    sp.CalculatedSpecialExtraHoursInMinutes,
                    CalculatedSpecialExtraHours = $"{sp.CalculatedSpecialExtraHoursInMinutes / 60}:{sp.CalculatedSpecialExtraHoursInMinutes % 60:00}",
                    sp.Active
                })
                .AsNoTracking()
                .ToListAsync<dynamic>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recuperando horas extras especiales para el empleado {IdEmployee} entre las fechas {StartDate} y {EndDate}",
                idEmployee, startDate, endDate);
            throw;
        }
    }

    public async Task<SpecialExtraHours> Save(SpecialExtraHours specialExtraHours)
    {
        try
        {
            _context.SpecialExtraHours.Add(specialExtraHours);
            await _context.SaveChangesAsync();
            return specialExtraHours;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving special extra hours");
            throw;
        }
    }
    
    public async Task<SpecialExtraHours> Update(int id, SpecialExtraHours specialExtraHours)
    {
        var existingSpecialExtraHours = await _context.SpecialExtraHours.FindAsync(id);
        if (existingSpecialExtraHours == null)
        {
            throw new KeyNotFoundException($"SpecialExtraHours with id {id} not found.");
        }
        try
        {
            existingSpecialExtraHours.StartDate = specialExtraHours.StartDate;
            existingSpecialExtraHours.EndDate = specialExtraHours.EndDate;
            existingSpecialExtraHours.Active = specialExtraHours.Active;
            await _context.SaveChangesAsync();
            return specialExtraHours;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating special extra hours");
            throw;
        }
    }

    public Task<SpecialExtraHours> Delete(int id)
    {
        var existingSpecialExtraHours = _context.SpecialExtraHours.Find(id);
        if (existingSpecialExtraHours == null)
        {
            throw new KeyNotFoundException($"SpecialExtraHours with id {id} not found.");
        }
        try
        {
            existingSpecialExtraHours.Active = false;
            _context.SaveChanges();
            return Task.FromResult(existingSpecialExtraHours);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting special extra hours");
            throw;
        }
    }
}

public interface ISpecialExtraHoursService
{
    Task<List<dynamic>> GetSpecialExtraHours(int idEmployee, DateTime startDate, DateTime endDate);
    Task<SpecialExtraHours> Save(SpecialExtraHours specialExtraHours);
    Task<SpecialExtraHours> Update(int id, SpecialExtraHours specialExtraHours);
    Task<SpecialExtraHours> Delete(int id);
}