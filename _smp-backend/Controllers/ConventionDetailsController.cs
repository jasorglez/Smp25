using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ConventionDetailsController : ControllerBase
{
    private readonly ILogger<ConventionDetailsController> _logger;
    private readonly IConventionDetailsService _conventionDetailsService;
    
    public ConventionDetailsController(IConventionDetailsService conventionDetailsService, 
        ILogger<ConventionDetailsController> logger)
    {
        _conventionDetailsService = conventionDetailsService ?? throw new ArgumentNullException(nameof(conventionDetailsService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    [HttpGet()]
    public async Task<ActionResult<ConventionDetails?>> Get(int conventionId)
    {
        try
        {
            var conventionDetails = await _conventionDetailsService.GetElementsFromConventionDetails(conventionId);
            if (conventionDetails == null || !conventionDetails.Any())
            {
                _logger.LogWarning("No convention details found for convention ID {ConventionId}", conventionId);
                return NotFound(new { Message = "No data found", ConventionDetails = new List<object>() });
            }
            return Ok(conventionDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving convention details for convention ID {ConventionId}", conventionId);
            return StatusCode(500, "An error occurred while retrieving convention details");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Post([FromBody] ConventionDetails conventionDetails)
    {
        if (conventionDetails == null)
        {
            _logger.LogWarning("Received null convention details");
            return BadRequest("Convention details cannot be null");
        }

        try
        {
            await _conventionDetailsService.Save(conventionDetails);
            return CreatedAtAction(nameof(Get), new { conventionId = conventionDetails.IdConvention }, conventionDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving convention details");
            return StatusCode(500, "An error occurred while saving convention details");
        }
    }
    
    [HttpPut("{id}")]
    public async Task<ActionResult<ConventionDetails?>> Put(int id, [FromBody] ConventionDetails conventionDetails)
    {
        if (conventionDetails == null)
        {
            _logger.LogWarning("Received null convention details for update");
            return BadRequest("Convention details cannot be null");
        }

        try
        {
            var updatedConventionDetails = await _conventionDetailsService.Update(id, conventionDetails);
            if (updatedConventionDetails == null)
            {
                _logger.LogWarning("Convention Details with ID {Id} not found", id);
                return NotFound(new { Message = "Convention Details not found" });
            }
            return Ok(updatedConventionDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating convention details with ID {Id}", id);
            return StatusCode(500, "An error occurred while updating convention details");
        }
    }
    
    [HttpDelete("{id}")]
    public async Task<ActionResult<bool>> Delete(int id)
    {
        try
        {
            var deleted = await _conventionDetailsService.Delete(id);
            if (!deleted)
            {
                _logger.LogWarning("Convention Details with ID {Id} not found", id);
                return NotFound(new { Message = "Convention Details not found" });
            }
            return Ok(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting convention details with ID {Id}", id);
            return StatusCode(500, "An error occurred while deleting convention details");
        }
    }
}