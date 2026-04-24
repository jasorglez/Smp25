using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatClavesUnidadesController : ControllerBase
{
    private readonly ILogger<CatSatClavesUnidadesController> _logger;
    private readonly IClavesUnidadesService _clavesUnidadesService;

    public CatSatClavesUnidadesController(IClavesUnidadesService clavesUnidadesService, ILogger<CatSatClavesUnidadesController> logger)
    {
        _clavesUnidadesService = clavesUnidadesService ?? throw new ArgumentNullException(nameof(clavesUnidadesService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllClavesUnidades()
    {
        try
        {
            var clavesUnidadesList = await _clavesUnidadesService.GetAllClavesUnidades();
            return Ok(clavesUnidadesList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ClavesUnidades");
            return StatusCode(500, "An error occurred while retrieving ClavesUnidades.");
        }
    }

    [HttpGet("GetById/{idClavesUnidades}")]
    public async Task<IActionResult> GetByClaveUnidad(string idClavesUnidades)
    {
        try
        {
            var claveUnidad = await _clavesUnidadesService.GetByClaveUnidad(idClavesUnidades);
            if (claveUnidad == null)
            {
                _logger.LogWarning("No clavesUnidades found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(claveUnidad);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving ClavesUnidades");
            return StatusCode(500, "An error occurred while retrieving ClavesUnidades.");
        }
    }

    [HttpGet("SearchByTexto")]
    public async Task<IActionResult> GetByTexto([FromQuery] string texto)
    {
        try
        {
            var claveUnidades = await _clavesUnidadesService.GetByTexto(texto);
            if (claveUnidades == null || !claveUnidades.Any())
            {
                _logger.LogWarning("No productosServicios found for search text: {Texto}", texto);
                return NotFound(new { Message = $"No data found for search text: {texto}" });
            }
            return Ok(claveUnidades);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid search text: {Texto}", texto);
            return BadRequest(new { Message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching ProductosServicios with text: {Texto}", texto);
            return StatusCode(500, "An error occurred while searching Clave Unidades.");
        }
    }

}