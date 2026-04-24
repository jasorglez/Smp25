using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Fact;

namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CatSatUsosCfdiController : ControllerBase
{
    private readonly ILogger<CatSatUsosCfdiController> _logger;
    private readonly IUsosCfdiService _usosCfdiService;

    public CatSatUsosCfdiController(IUsosCfdiService usosCfdiService, ILogger<CatSatUsosCfdiController> logger)
    {
        _usosCfdiService = usosCfdiService ?? throw new ArgumentNullException(nameof(usosCfdiService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("GetAll")]
    public async Task<IActionResult> GetAllUsosCfdi()
    {
        try
        {
            var usosCfdiList = await _usosCfdiService.GetAllUsosCfdi();
            return Ok(usosCfdiList);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving UsosCfdi");
            return StatusCode(500, "An error occurred while retrieving UsosCfdi.");
        }
    }

    [HttpGet("GetById/{idUsoCfdi}")]
    public async Task<IActionResult> GetByUsoCfdi(string idUsoCfdi)
    {
        try
        {
            var usoCfdi = await _usosCfdiService.GetByUsoCfdi(idUsoCfdi);
            if (usoCfdi == null)
            {
                _logger.LogWarning("No usosCfdi found or the result is empty");
                return NotFound(new { Message = "No data found" });
            }
            return Ok(usoCfdi);
        }

        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving UsosCfdi");
            return StatusCode(500, "An error occurred while retrieving UsosCfdi.");
        }
    }
}