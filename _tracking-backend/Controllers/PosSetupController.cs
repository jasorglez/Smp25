using MicroServicioTracking.Services;

namespace MicroServicioTracking.Controllers;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;

[Authorize]
[ApiController]
[Route("api/[controller]")]

public class PosSetupController : ControllerBase
{
    private readonly IPosSetupService _posSetupService;
    private readonly ILogger<PosSetupController> _logger;

    public PosSetupController(IPosSetupService posSetupService, ILogger<PosSetupController> logger)
    {
        _posSetupService = posSetupService;
        _logger = logger;
    }

    [HttpGet("{branchId}")]
    public async Task<ActionResult<List<Object>>> GetByBranch(int branchId)
    {
        try
        {
            var result = await _posSetupService.GetByBranch(branchId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            return StatusCode(500, "Internal server error");
        }
    }
    
    [HttpGet("{branchId}/{customerId}")]
    public async Task<ActionResult<List<PosSetup>>> GetByBranchAndCustomer(int branchId, int customerId)
    {
        try
        {
            var result = await _posSetupService.GetByBranchAndCustomer(branchId, customerId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] PosSetup posSetup)
    {
        try
        {
            await _posSetupService.Save(posSetup);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            return StatusCode(500, "Internal server error");
        }
    }

    [HttpPut("{branchId}/{customerId}")]
    public async Task<ActionResult<PosSetup>> Update(int branchId, int customerId, [FromBody] PosSetup posSetup)
    {
        try
        {
            var updatedPosSetup = await _posSetupService.Update(branchId, customerId, posSetup);
            if (updatedPosSetup == null)
            {
                return NotFound();
            }

            return Ok(updatedPosSetup);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            return StatusCode(500, "Internal server error");
        }
    }
}