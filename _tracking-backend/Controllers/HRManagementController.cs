using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class HRManagementController : ControllerBase
{
    private readonly IHRManagementService _hrManagementService;
    private readonly ILogger<HRManagementController> _logger;

    public HRManagementController(IHRManagementService hrManagementService, ILogger<HRManagementController> logger)
    {
        _hrManagementService = hrManagementService;
        _logger = logger;
    }
    
    [HttpGet("{idBranch}")]
    public async Task<ActionResult<List<HRManagement>>> ConfigByBranch(int idBranch)
    {
        try
        {
            var result = await _hrManagementService.ConfigByRoot(idBranch);
            if (result == null || !result.Any())
            {
                return NotFound();
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving billing for branch {IdRoot}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] HRManagement hrManagement)
    {
        try
        {
            await _hrManagementService.Save(hrManagement);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating hr management data");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{idBranch}")]
    public async Task<ActionResult<HRManagement>> Update(int idBranch, [FromBody] HRManagement hrManagement)
    {
        try
        {
            var updatedHRManagement = await _hrManagementService.Update(idBranch, hrManagement);
            if (updatedHRManagement == null)
            {
                return NotFound();
            }

            return Ok(updatedHRManagement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating management with id Branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}