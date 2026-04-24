
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatProductosServiciosController : ControllerBase
{
    private readonly ILogger<CatSatProductosServiciosController> _logger;
    private readonly IProductosServiciosService _productosServiciosService;

    public CatSatProductosServiciosController(IProductosServiciosService productosServiciosService, ILogger<CatSatProductosServiciosController> logger)
    {
        _productosServiciosService = productosServiciosService ?? throw new ArgumentNullException(nameof(productosServiciosService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllProductosServicios()
    {
        try
        {
            var productosServiciosList = await _productosServiciosService.GetAllProductosServicios();
            return Ok(productosServiciosList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ProductosServicios");
            return StatusCode(500, "An error occurred while retrieving ProductosServicios.");
        }
    }

    [HttpGet("GetById/{idProductosServicios}")]
    public async Task<IActionResult> GetByProductoServicio(string idProductosServicios)
    {
        try
        {
            var productoServicio = await _productosServiciosService.GetByProductoServicio(idProductosServicios);
            if (productoServicio == null)
            {
                _logger.LogWarning("No productosServicios found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(productoServicio);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ProductosServicios");
            return StatusCode(500, "An error occurred while retrieving ProductosServicios.");
        }
    }

    [HttpGet("SearchByTexto")]
    public async Task<IActionResult> GetByTexto([FromQuery] string texto)
    {
        try
        {
            var productosServicios = await _productosServiciosService.GetByTexto(texto);
            if (productosServicios == null || !productosServicios.Any())
            {
                _logger.LogWarning("No productosServicios found for search text: {Texto}", texto);
                return NotFound(new { Message = $"No data found for search text: {texto}" });
            }
            return Ok(productosServicios);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid search text: {Texto}", texto);
            return BadRequest(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching ProductosServicios with text: {Texto}", texto);
            return StatusCode(500, "An error occurred while searching ProductosServicios.");
        }
    }
}