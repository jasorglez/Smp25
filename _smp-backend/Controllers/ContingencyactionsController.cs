
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ContingencyactionsController : ControllerBase
    {
        private readonly IContingencyActionService _contingencyActionService;
        private readonly ILogger<ContingencyactionsController> _logger;

        public ContingencyactionsController(IContingencyActionService contingencyActionService, ILogger<ContingencyactionsController> logger)
        {
            _contingencyActionService = contingencyActionService ?? throw new ArgumentNullException(nameof(contingencyActionService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<Contingencyaction>>> Get(int idAnalysis)
        {
            try
            {
                var result = await _contingencyActionService.Get(idAnalysis);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting ContingencyActions");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Contingencyaction>> Post([FromBody] Contingencyaction contingencyAction)
        {
            try
            {
                var result = await _contingencyActionService.Save(contingencyAction);
                return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving ContingencyAction");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Put(int id, [FromBody] Contingencyaction contingencyAction)
        {
            try
            {
                var result = await _contingencyActionService.Update(id, contingencyAction);
                if (result == null)
                {
                    return NotFound();
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ContingencyAction with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _contingencyActionService.Delete(id);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ContingencyAction with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}