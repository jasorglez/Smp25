using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ContractDetailsController: ControllerBase
{
    private readonly IContractDetailsService _contractDetailsService;
    private readonly ILogger<ContractDetailsController> _logger;

    public ContractDetailsController(IContractDetailsService contractDetailsService,
        ILogger<ContractDetailsController> logger)
    {
        _contractDetailsService = contractDetailsService ?? throw new ArgumentNullException(nameof(contractDetailsService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    [HttpGet()]
    public async Task<ActionResult<ContractDetails?>> Get(int contractId)
    {
        try
        {
            var contractDetails = await _contractDetailsService.GetElementsFromContractDetails(contractId);
            if (contractDetails == null || !contractDetails.Any())
            {
                _logger.LogWarning("No contract details found for contract ID {ContractId}", contractId);
                return NotFound(new { Message = "No data found", ContractDetails = new List<object>() });
            }
            return Ok(contractDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving contract details for contract ID {ContractId}", contractId);
            return StatusCode(500, "An error occurred while retrieving contract details");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Post([FromBody] ContractDetails contractDetails)
    {
        if (contractDetails == null)
        {
            _logger.LogWarning("Received null contract details");
            return BadRequest("Contract details cannot be null");
        }

        try
        {
            await _contractDetailsService.Save(contractDetails);
            return CreatedAtAction(nameof(Get), new { contractId = contractDetails.IdContract }, contractDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving contract details");
            return StatusCode(500, "An error occurred while saving contract details");
        }
    }
    [HttpPut("{id}")]
    public async Task<ActionResult<ContractDetails?>> Put(int id, [FromBody] ContractDetails contractDetails)
    {
        if (contractDetails == null)
        {
            _logger.LogWarning("Received null contract details for update");
            return BadRequest("Contract details cannot be null");
        }

        try
        {
            var updatedContractDetails = await _contractDetailsService.Update(id, contractDetails);
            if (updatedContractDetails == null)
            {
                _logger.LogWarning("Contract details with ID {Id} not found", id);
                return NotFound(new { Message = "Contract details not found" });
            }
            return Ok(updatedContractDetails);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating contract details with ID {Id}", id);
            return StatusCode(500, "An error occurred while updating contract details");
        }
    }
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var deleted = await _contractDetailsService.Delete(id);
            if (!deleted)
            {
                _logger.LogWarning("Contract details with ID {Id} not found for deletion", id);
                return NotFound(new { Message = "Contract details not found" });
            }
            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting contract details with ID {Id}", id);
            return StatusCode(500, "An error occurred while deleting contract details");
        }
    }
}