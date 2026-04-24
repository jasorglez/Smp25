using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class RegimenesFiscalesService : IRegimenesFiscalesService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<RegimenesFiscalesService> _logger;

    public RegimenesFiscalesService(DbTrackingContext context, ILogger<RegimenesFiscalesService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<RegimenesFiscales>> GetAllRegimenesFiscales()
    {
        var allRegimenesFiscales = await _context.RegimenesFiscales.ToListAsync();
        return allRegimenesFiscales;
    }

    public async Task<RegimenesFiscales> GetByRegimenFiscal(String idRegimenesFiscales)
    {
        var regimenFiscal = await _context.RegimenesFiscales.FirstOrDefaultAsync(r => r.IdRegimenesFiscales == idRegimenesFiscales);
        if (regimenFiscal == null)
        {
            _logger.LogWarning("Regimen Fiscal with ID {IdRegimenesFiscales} not found.", idRegimenesFiscales);
            throw new KeyNotFoundException($"Regimen Fiscal with ID {idRegimenesFiscales} not found.");
        }
        return regimenFiscal;
    }
}

public interface IRegimenesFiscalesService
{
    Task<List<RegimenesFiscales>> GetAllRegimenesFiscales();
    Task<RegimenesFiscales> GetByRegimenFiscal(String idRegimenesFiscales);
}