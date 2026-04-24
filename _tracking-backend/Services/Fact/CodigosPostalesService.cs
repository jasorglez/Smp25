using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class CodigosPostalesService : ICodigosPostalesService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<CodigosPostalesService> _logger;

    public CodigosPostalesService(DbTrackingContext context, ILogger<CodigosPostalesService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<CodigosPostales>> GetAllCodigosPostales()
    {
        var allCodigosPostales = await _context.CodigosPostales.ToListAsync();
        return allCodigosPostales;
    }

    public async Task<CodigosPostales> GetByCodigoPostal(String idCodigosPostales)
    {
        var codigoPostal = await _context.CodigosPostales.FirstOrDefaultAsync(c => c.IdCodigosPostales == idCodigosPostales);
        if (codigoPostal == null)
        {
            _logger.LogWarning("Codigo Postal with ID {IdCodigosPostales} not found.", idCodigosPostales);
            throw new KeyNotFoundException($"Codigo Postal with ID {idCodigosPostales} not found.");
        }
        return codigoPostal;
    }
}

public interface ICodigosPostalesService
{
    Task<List<CodigosPostales>> GetAllCodigosPostales();
    Task<CodigosPostales> GetByCodigoPostal(String idCodigosPostales);
}