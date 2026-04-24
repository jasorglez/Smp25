using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class HRManagementByRootController : ControllerBase
{
    private readonly IHRManagementByRootService _hrManagementByRootService;
    private readonly ILogger<HRManagementByRootController> _logger;

    public HRManagementByRootController(IHRManagementByRootService hrManagementByRootService, ILogger<HRManagementByRootController> logger)
    {
        _hrManagementByRootService = hrManagementByRootService;
        _logger = logger;
    }
    
    [HttpGet("{idRoot}")]
    public async Task<ActionResult<List<HRManagementByRoot>>> ConfigByRoot(int idRoot)
    {
        try
        {
            var result = await _hrManagementByRootService.ConfigByRoot(idRoot);
            if (result == null || !result.Any())
            {
                return NotFound();
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving billing for root {IdRoot}", idRoot);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] HRManagementByRoot hrManagementByRoot)
    {
        try
        {
            await _hrManagementByRootService.Save(hrManagementByRoot);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating hr management data");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{idRoot}")]
    public async Task<ActionResult<HRManagementByRoot>> Update(int idRoot, [FromBody] HRManagementByRoot hrManagementByRoot)
    {
        try
        {
            var updatedHRManagementByRoot = await _hrManagementByRootService.Update(idRoot, hrManagementByRoot);
            if (updatedHRManagementByRoot == null)
            {
                return NotFound();
            }

            return Ok(updatedHRManagementByRoot);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating management with id root {IdRoot}", idRoot);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}