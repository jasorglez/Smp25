
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ImplementationriskController : ControllerBase
    {
        private readonly IImplementationriskService _implementationRiskService;
        private readonly ILogger<ImplementationriskController> _logger;

        public ImplementationriskController(IImplementationriskService implementationRiskService,
            ILogger<ImplementationriskController> logger)
        {
            _implementationRiskService = implementationRiskService ??
                throw new ArgumentNullException(nameof(implementationRiskService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> GetImplementationRisks(int idPlanification)
        {
            try
            {
                var items = await _implementationRiskService.GetImplementationRisks(idPlanification);
                if (items == null || items.Count == 0)
                {
                    _logger.LogWarning("No ImplementationRisks found for planification {IdPlanification}", idPlanification);
                    return NotFound(new { Message = "No data found", ImplementationRisks = new List<object>() });
                }
                return Ok(items);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ImplementationRisks for planification {IdPlanification}", idPlanification);
                return StatusCode(500, "An error occurred while retrieving ImplementationRisks");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Implementationrisk implementationRisk)
        {
            try
            {
                await _implementationRiskService.Save(implementationRisk);
                return Ok(new
                {
                    Message = "Record New with Id",
                    id = implementationRisk.Id,
                    implementationRisk
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ImplementationRisk");
                return StatusCode(500, "An error occurred while creating the ImplementationRisk");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Implementationrisk implementationRisk)
        {
            try
            {
                var updatedItem = await _implementationRiskService.Update(id, implementationRisk);
                if (updatedItem == null)
                {
                    return NotFound();
                }
                return Ok(updatedItem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ImplementationRisk with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the ImplementationRisk");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _implementationRiskService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id });
                }
                return NotFound(new { Message = "Record Not Found with Id", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ImplementationRisk with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting ImplementationRisk");
            }
        }
    }
}