using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class MetodosPagoService : IMetodosPagoService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<MetodosPagoService> _logger;

    public MetodosPagoService(DbTrackingContext context, ILogger<MetodosPagoService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<MetodosPago>> GetAllMetodosPago()
    {
        var allMetodosPago = await _context.MetodosPagos.ToListAsync();
        return allMetodosPago;
    }

    public async Task<MetodosPago> GetByMetodoPago(String idMetodosPago)
    {
        var metodoPago = await _context.MetodosPagos.FirstOrDefaultAsync(m => m.IdMetodosPago == idMetodosPago);
        if (metodoPago == null)
        {
            _logger.LogWarning("Metodo Pago with ID {IdMetodosPago} not found.", idMetodosPago);
            throw new KeyNotFoundException($"Metodo Pago with ID {idMetodosPago} not found.");
        }
        return metodoPago;
    }
}

public interface IMetodosPagoService
{
    Task<List<MetodosPago>> GetAllMetodosPago();
    Task<MetodosPago> GetByMetodoPago(String idMetodosPago);
}