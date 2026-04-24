using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class ClavesUnidadesService : IClavesUnidadesService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<ClavesUnidadesService> _logger;

    public ClavesUnidadesService(DbTrackingContext context, ILogger<ClavesUnidadesService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<ClavesUnidades>> GetAllClavesUnidades()
    {
        var allClavesUnidades = await _context.ClavesUnidades.ToListAsync();
        return allClavesUnidades;
    }

    public async Task<ClavesUnidades> GetByClaveUnidad(String idClavesUnidades)
    {
        var claveUnidad = await _context.ClavesUnidades.FirstOrDefaultAsync(c => c.IdClavesUnidades == idClavesUnidades);
        if (claveUnidad == null)
        {
            _logger.LogWarning("Clave Unidad with ID {IdClavesUnidades} not found.", idClavesUnidades);
            throw new KeyNotFoundException($"Clave Unidad with ID {idClavesUnidades} not found.");
        }
        return claveUnidad;
    }

    public async Task<List<ClavesUnidades>> GetByTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            _logger.LogWarning("Search text cannot be null or empty.");
            throw new ArgumentException("Search text cannot be null or empty.", nameof(texto));
        }

        var claveUnidades = await _context.ClavesUnidades
            .Where(p => EF.Functions.Like(p.Texto, $"%{texto}%"))
            .ToListAsync();

        _logger.LogInformation("Found {Count} productos servicios matching text: {Texto}", claveUnidades.Count, texto);
        return claveUnidades;
    }


}

public interface IClavesUnidadesService
{
    Task<List<ClavesUnidades>> GetAllClavesUnidades();
    Task<ClavesUnidades> GetByClaveUnidad(String idClavesUnidades);
    Task<List<ClavesUnidades>> GetByTexto(string texto);
}