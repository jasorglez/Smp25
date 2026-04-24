using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class AnalysisRiskController : ControllerBase
    {
        private readonly IAnalysisRiskService _analysisRiskService;
        private readonly ILogger<AnalysisRiskController> _logger;

        public AnalysisRiskController(IAnalysisRiskService analysisRiskService, ILogger<AnalysisRiskController> logger)
        {
            _analysisRiskService = analysisRiskService ?? throw new ArgumentNullException(nameof(analysisRiskService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetAnalysisRisks(int idIdent)
        {
            try
            {
                var analysisRisks = await _analysisRiskService.GetAnalysisRisks(idIdent);
                if (analysisRisks == null || analysisRisks.Count == 0)
                {
                    _logger.LogWarning("No Analysis Risks found or the result is empty for project {IdProject}", idIdent);
                    return NotFound(new { Message = "No data found", AnalysisRisks = new List<object>() });
                }
                return Ok(analysisRisks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Analysis Risks for project {IdProject}", idIdent);
                return StatusCode(500, "An error occurred while retrieving Analysis Risks");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Analysisrisk analysisRisk)
        {
            try
            {
                await _analysisRiskService.Save(analysisRisk);
                return Ok(new { Message = "Record New with Id", id = analysisRisk.Id, analysisRisk = analysisRisk });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Analysis Risk");
                return StatusCode(500, "An error occurred while creating the Analysis Risk");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Analysisrisk analysisRisk)
        {
            try
            {
                var updatedAnalysisRisk = await _analysisRiskService.Update(id, analysisRisk);
                if (updatedAnalysisRisk == null)
                {
                    return NotFound();
                }
                return Ok(updatedAnalysisRisk);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Analysis Risk with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Analysis Risk.");
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
                var success = await _analysisRiskService.Delete(id);
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
                _logger.LogError(ex, "Error deleting Analysis Risk with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting Analysis Risk");
            }
        }
    }
}