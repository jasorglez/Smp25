using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatFormasPagoController : ControllerBase
{
    private readonly ILogger<CatSatFormasPagoController> _logger;
    private readonly IFormasPagoService _formasPagoService;

    public CatSatFormasPagoController(IFormasPagoService formasPagoService, ILogger<CatSatFormasPagoController> logger)
    {
        _formasPagoService = formasPagoService ?? throw new ArgumentNullException(nameof(formasPagoService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllFormasPago()
    {
        try
        {
            var formasPagoList = await _formasPagoService.GetAllFormasPago();
            return Ok(formasPagoList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving FormasPago");
            return StatusCode(500, "An error occurred while retrieving FormasPago.");
        }
    }

    [HttpGet("GetById/{idFormasPago}")]
    public async Task<IActionResult> GetByFormaPago(string idFormasPago)
    {
        try
        {
            var formaPago = await _formasPagoService.GetByFormaPago(idFormasPago);
            if (formaPago == null)
            {
                _logger.LogWarning("No formasPago found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(formaPago);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving FormasPago");
            return StatusCode(500, "An error occurred while retrieving FormasPago.");
        }
    }
}