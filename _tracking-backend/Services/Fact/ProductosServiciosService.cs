using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.Fact;

namespace MicroServicioTracking.Services.Fact;

public class ProductosServiciosService : IProductosServiciosService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<ProductosServiciosService> _logger;

    public ProductosServiciosService(DbTrackingContext context, ILogger<ProductosServiciosService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<ProductosServicios>> GetAllProductosServicios()
    {
        var allProductosServicios = await _context.ProductosServicios.ToListAsync();
        return allProductosServicios;
    }

    public async Task<ProductosServicios> GetByProductoServicio(String idProductosServicios)
    {
        var productoServicio = await _context.ProductosServicios.FirstOrDefaultAsync(p => p.IdProductosServicios == idProductosServicios);
        if (productoServicio == null)
        {
            _logger.LogWarning("Producto Servicio with ID {IdProductosServicios} not found.", idProductosServicios);
            throw new KeyNotFoundException($"Producto Servicio with ID {idProductosServicios} not found.");
        }
        return productoServicio;
    }

    public async Task<List<ProductosServicios>> GetByTexto(string texto)
    {
        if (string.IsNullOrWhiteSpace(texto))
        {
            _logger.LogWarning("Search text cannot be null or empty.");
            throw new ArgumentException("Search text cannot be null or empty.", nameof(texto));
        }

        var productosServicios = await _context.ProductosServicios
            .Where(p => EF.Functions.Like(p.Texto, $"%{texto}%"))
            .ToListAsync();

        _logger.LogInformation("Found {Count} productos servicios matching text: {Texto}", productosServicios.Count, texto);
        return productosServicios;
    }
}

public interface IProductosServiciosService
{
    Task<List<ProductosServicios>> GetAllProductosServicios();
    Task<ProductosServicios> GetByProductoServicio(String idProductosServicios);
    Task<List<ProductosServicios>> GetByTexto(string texto);
}