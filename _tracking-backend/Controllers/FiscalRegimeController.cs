using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FiscalRegimeController : ControllerBase
{
    private readonly IFiscalRegimeService _fiscalRegimeService;
    private readonly ILogger<FiscalRegimeController> _logger;

    public FiscalRegimeController(IFiscalRegimeService fiscalRegimeService, ILogger<FiscalRegimeController> logger)
    {
        _fiscalRegimeService = fiscalRegimeService;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<List<FiscalRegime>>> GetRegimeListAsync()
    {
        try
        {
            var result = await _fiscalRegimeService.GetRegimeListAsync();
            if (result == null || !result.Any())
            {
                return NotFound();
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving fiscal regimes");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}