using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class UsosCfdiService : IUsosCfdiService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<UsosCfdiService> _logger;

    public UsosCfdiService(DbTrackingContext context, ILogger<UsosCfdiService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<UsosCfdi>> GetAllUsosCfdi()
    {
        var allUsosCfdi = await _context.UsosCfdis.ToListAsync();
        return allUsosCfdi;
    }
    
    public async Task<UsosCfdi> GetByUsoCfdi(String idUsosCfdi)
    {
        var usoCfdi = await _context.UsosCfdis.FirstOrDefaultAsync(u => u.IdUsosCfdi == idUsosCfdi);
        if (usoCfdi == null)
        {
            _logger.LogWarning("Uso CFDI with ID {IdUsosCfdi} not found.", idUsosCfdi);
            throw new KeyNotFoundException($"Uso CFDI with ID {idUsosCfdi} not found.");
        }
        return usoCfdi;
    }
}

public interface IUsosCfdiService
{
    Task<List<UsosCfdi>> GetAllUsosCfdi();
    Task<UsosCfdi> GetByUsoCfdi(String idUsosCfdi);
}
    