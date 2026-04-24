using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{    
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class StakeholderController : ControllerBase
    {
        private readonly IStakeholderService _stakeholderService;
        private readonly ILogger<StakeholderController> _logger;

        public StakeholderController(IStakeholderService stakeholderService, ILogger<StakeholderController> logger)
        {
            _stakeholderService = stakeholderService ?? throw new ArgumentNullException(nameof(stakeholderService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<IActionResult> GetStakeholders(int idProject, DateTime date)
        {
            try
            {
                var stakeholders = await _stakeholderService.StakeholdersxProject(idProject,date);
                if (stakeholders == null || stakeholders.Count == 0)
                {
                    _logger.LogWarning("No Stakeholders or the result is empty");
                    return NotFound(new { Message = "No data found", Stakeholder = new List<object>() });
                }
                return Ok(stakeholders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Stakeholders for project {IdProject}", idProject);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpGet("date")]
        public async Task<IActionResult> GetStakeholdersByDate(DateTime date)
        {
            try
            {
                var stakeholders = await _stakeholderService.StakeholdersxDate(date);
                if (stakeholders == null || !stakeholders.Any())
                {
                    _logger.LogWarning("No Stakeholders or the result is empty");
                    return NotFound(new { Message = "No data found", Stakeholder = new List<object>() });
                }
                return Ok(stakeholders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Stakeholders for date {Date}", date);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<IActionResult> PostStakeholder([FromBody] Stakeholder stakeholder)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _stakeholderService.Save(stakeholder);
                return CreatedAtAction(nameof(GetStakeholders), new { idProject = stakeholder.IdProject }, stakeholder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving Stakeholder");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutStakeholder(int id, [FromBody] Stakeholder stakeholder)
        {
            if (id != stakeholder.Id)
            {
                return BadRequest("The ID in the URL does not match the ID in the body.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedStakeholder = await _stakeholderService.Update(id, stakeholder);
                if (updatedStakeholder == null)
                {
                    return NotFound($"Stakeholder with ID {id} not found.");
                }
                return Ok(updatedStakeholder);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Stakeholder with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteStakeholder(int id)
        {
            try
            {
                var result = await _stakeholderService.Delete(id);
                if (!result)
                {
                    return NotFound($"Stakeholder with ID {id} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Stakeholder with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}