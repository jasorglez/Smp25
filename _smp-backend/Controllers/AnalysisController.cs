using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using System.Diagnostics.Contracts;
using System.Threading.Tasks;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AnalysisController : ControllerBase
    {
        private readonly IAnalysisService _analysisService;
        private readonly ILogger<AnalysisController> _logger;

        public AnalysisController(IAnalysisService analysisService, ILogger<AnalysisController> logger)
        {
            _analysisService = analysisService ?? throw new ArgumentNullException(nameof(analysisService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<Analysi>>> Get(int idIdentif)
        {
            try
            {
                var result = await _analysisService.Get(idIdentif);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Analysys found or the result is empty");
                    return NotFound(new { Message = "No data found", Analysys = new List<object>() });
                }                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Analyses for identification {IdIdentification}", idIdentif);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpGet("totalxseverity")]
        public async Task<ActionResult<List<Analysi>>> TotalSeverity()
        {
            try
            {
                var result = await _analysisService.totalxseverity();
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Analysys found or the result is empty");
                    return NotFound(new { Message = "No data found", Analysys = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Analyses for identification {IdIdentification}");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Analysi>> Post([FromBody] Analysi analysis)
        {
            try
            {
                var result = await _analysisService.Save(analysis);
                return CreatedAtAction(nameof(Get), new { idIdentification = result.IdIdentification }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving Analysis");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Put(int id, [FromBody] Analysi an)
        {
            try
            {
                var result = await _analysisService.Update(id, an);
                if (result == null)
                {
                    return NotFound();
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Analysis with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
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
                var success = await _analysisService.Delete(id);
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
                _logger.LogError(ex, "Error updating Analysys with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Analysis");
            }
        }
    }
}