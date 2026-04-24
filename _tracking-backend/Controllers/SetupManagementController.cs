using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SetupManagementController : ControllerBase
{
    private readonly ISetupManagementService _setupManagementService;
    private readonly ILogger<SetupManagementController> _logger;

    public SetupManagementController(ISetupManagementService setupManagementService,
        ILogger<SetupManagementController> logger)
    {
        _setupManagementService = setupManagementService;
        _logger = logger;
    }

    [HttpGet("{idRoot}")]
    public async Task<ActionResult<List<SetupManagement>>> ConfigByRoot(int idRoot)
    {
        try
        {
            var result = await _setupManagementService.ConfigByRoot(idRoot);
            if (result == null || !result.Any())
            {
                return NotFound();
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving setup for root {IdRoot}", idRoot);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] SetupManagement setupManagement)
    {
        try
        {
            await _setupManagementService.Save(setupManagement);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating setup");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{idRoot}")]
    public async Task<ActionResult<SetupManagement>> Update(int idRoot, [FromBody] SetupManagement setupManagement)
    {
        try
        {
            var updatedSetupManagement = await _setupManagementService.Update(idRoot, setupManagement);
            if (updatedSetupManagement == null)
            {
                return NotFound();
            }

            return Ok(updatedSetupManagement);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating setup with id Root {IdRoot}", idRoot);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}