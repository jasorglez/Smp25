using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class FormasPagoService : IFormasPagoService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<FormasPagoService> _logger;

    public FormasPagoService(DbTrackingContext context, ILogger<FormasPagoService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<FormasPago>> GetAllFormasPago()
    {
        var allFormasPago = await _context.FormasPagos.ToListAsync();
        return allFormasPago;
    }

    public async Task<FormasPago> GetByFormaPago(String idFormasPago)
    {
        var formaPago = await _context.FormasPagos.FirstOrDefaultAsync(f => f.IdFormasPago == idFormasPago);
        if (formaPago == null)
        {
            _logger.LogWarning("Forma Pago with ID {IdFormasPago} not found.", idFormasPago);
            throw new KeyNotFoundException($"Forma Pago with ID {idFormasPago} not found.");
        }
        return formaPago;
    }
}

public interface IFormasPagoService
{
    Task<List<FormasPago>> GetAllFormasPago();
    Task<FormasPago> GetByFormaPago(String idFormasPago);
}