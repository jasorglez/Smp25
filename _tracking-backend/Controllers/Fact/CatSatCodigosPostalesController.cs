using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatCodigosPostalesController : ControllerBase
{
    private readonly ILogger<CatSatCodigosPostalesController> _logger;
    private readonly ICodigosPostalesService _codigosPostalesService;

    public CatSatCodigosPostalesController(ICodigosPostalesService codigosPostalesService, ILogger<CatSatCodigosPostalesController> logger)
    {
        _codigosPostalesService = codigosPostalesService ?? throw new ArgumentNullException(nameof(codigosPostalesService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllCodigosPostales()
    {
        try
        {
            var codigosPostalesList = await _codigosPostalesService.GetAllCodigosPostales();
            return Ok(codigosPostalesList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving CodigosPostales");
            return StatusCode(500, "An error occurred while retrieving CodigosPostales.");
        }
    }

    [HttpGet("GetById/{idCodigosPostales}")]
    public async Task<IActionResult> GetByCodigoPostal(string idCodigosPostales)
    {
        try
        {
            var codigoPostal = await _codigosPostalesService.GetByCodigoPostal(idCodigosPostales);
            if (codigoPostal == null)
            {
                _logger.LogWarning("No codigosPostales found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(codigoPostal);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving CodigosPostales");
            return StatusCode(500, "An error occurred while retrieving CodigosPostales.");
        }
    }
}