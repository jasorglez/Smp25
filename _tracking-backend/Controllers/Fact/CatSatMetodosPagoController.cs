using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatMetodosPagoController : ControllerBase
{
    private readonly ILogger<CatSatMetodosPagoController> _logger;
    private readonly IMetodosPagoService _metodosPagoService;

    public CatSatMetodosPagoController(IMetodosPagoService metodosPagoService, ILogger<CatSatMetodosPagoController> logger)
    {
        _metodosPagoService = metodosPagoService ?? throw new ArgumentNullException(nameof(metodosPagoService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllMetodosPago()
    {
        try
        {
            var metodosPagoList = await _metodosPagoService.GetAllMetodosPago();
            return Ok(metodosPagoList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving MetodosPago");
            return StatusCode(500, "An error occurred while retrieving MetodosPago.");
        }
    }

    [HttpGet("GetById/{idMetodosPago}")]
    public async Task<IActionResult> GetByMetodoPago(string idMetodosPago)
    {
        try
        {
            var metodoPago = await _metodosPagoService.GetByMetodoPago(idMetodosPago);
            if (metodoPago == null)
            {
                _logger.LogWarning("No metodosPago found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(metodoPago);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving MetodosPago");
            return StatusCode(500, "An error occurred while retrieving MetodosPago.");
        }
    }
}