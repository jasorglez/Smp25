using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class FiscalRegimeService: IFiscalRegimeService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<FiscalRegimeService> _logger;

    public FiscalRegimeService(DbTrackingContext context, ILogger<FiscalRegimeService> logger)
    {
        _context = context ?? throw new ArgumentException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<List<FiscalRegime>> GetRegimeListAsync()
    {
        try
        {

            return await _context.FiscalRegimes
                .OrderBy(f => f.Id)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Fiscal Regime");
            throw;
        }
    }
}

public interface IFiscalRegimeService
{
    Task<List<FiscalRegime>> GetRegimeListAsync();
}