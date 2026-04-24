using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatRegimenesFiscalesController : ControllerBase
{
    private readonly ILogger<CatSatRegimenesFiscalesController> _logger;
    private readonly IRegimenesFiscalesService _regimenesFiscalesService;

    public CatSatRegimenesFiscalesController(IRegimenesFiscalesService regimenesFiscalesService, ILogger<CatSatRegimenesFiscalesController> logger)
    {
        _regimenesFiscalesService = regimenesFiscalesService ?? throw new ArgumentNullException(nameof(regimenesFiscalesService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllRegimenesFiscales()
    {
        try
        {
            var regimenesFiscalesList = await _regimenesFiscalesService.GetAllRegimenesFiscales();
            return Ok(regimenesFiscalesList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving RegimenesFiscales");
            return StatusCode(500, "An error occurred while retrieving RegimenesFiscales.");
        }
    }

    [HttpGet("GetById/{idRegimenesFiscales}")]
    public async Task<IActionResult> GetByRegimenFiscal(string idRegimenesFiscales)
    {
        try
        {
            var regimenFiscal = await _regimenesFiscalesService.GetByRegimenFiscal(idRegimenesFiscales);
            if (regimenFiscal == null)
            {
                _logger.LogWarning("No regimenesFiscales found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(regimenFiscal);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving RegimenesFiscales");
            return StatusCode(500, "An error occurred while retrieving RegimenesFiscales.");
        }
    }
}