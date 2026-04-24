using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PlanificationriskController : ControllerBase
    {
        private readonly IPlanificationRiskService _planificationRiskService;
        private readonly ILogger<PlanificationriskController> _logger;

        public PlanificationriskController(IPlanificationRiskService planificationRiskService, ILogger<PlanificationriskController> logger)
        {
            _planificationRiskService = planificationRiskService ?? throw new ArgumentNullException(nameof(planificationRiskService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetPlanificationRisks(int idAnalisis)
        {
            try
            {
                var items = await _planificationRiskService.GetPlanificationRisks(idAnalisis);
                if (items == null || items.Count == 0)
                {
                    _logger.LogWarning("No PlanificationRisks found or the result is empty for analysis {IdAnalisis}", idAnalisis);
                    return NotFound(new { Message = "No data found", PlanificationRisks = new List<object>() });
                }
                return Ok(items);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving PlanificationRisks for analysis {IdAnalisis}", idAnalisis);
                return StatusCode(500, "An error occurred while retrieving PlanificationRisks");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] PlanificationRisk planificationRisk)
        {
            try
            {
                await _planificationRiskService.Save(planificationRisk);
                return Ok(new { Message = "Record New with Id", id = planificationRisk.Id, planificationRisk = planificationRisk });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating PlanificationRisk");
                return StatusCode(500, "An error occurred while creating the PlanificationRisk");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] PlanificationRisk planificationRisk)
        {
            try
            {
                var updatedItem = await _planificationRiskService.Update(id, planificationRisk);
                if (updatedItem == null)
                {
                    return NotFound();
                }
                return Ok(updatedItem);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating PlanificationRisk with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the PlanificationRisk.");
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
                var success = await _planificationRiskService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting PlanificationRisk with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting PlanificationRisk");
            }
        }
    }
}