using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class EstimatesController : ControllerBase
    {
        private readonly IEstimateService _service;
        private readonly ILogger<EstimatesController> _logger;

        public EstimatesController(IEstimateService service, ILogger<EstimatesController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetEstimates(int idContract)
        {
            try
            {
                var result = await _service.GetEstimates(idContract);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Estimates found ", idContract);
                    return NotFound(new { Message = "No data found", Estimates = new List<object>() });
                }
                    return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting estimates for contract {IdContract}", idContract);
                return StatusCode(500, "An error occurred while retrieving the estimates");
            }
        }

        [HttpGet("{idRoot}")]
        public async Task<ActionResult<List<object>>> GetEstimatesxRoot(int idRoot)
        {
            try
            {
                var result = await _service.GetEstimatesxRoot(idRoot);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Companies found ", idRoot);
                    return NotFound(new { Message = "No data found", Estimates = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Company for contract {IdRoot}", idRoot);
                return StatusCode(500, "An error occurred while retrieving the estimates");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Estimate>> GetById(int id)
        {
            try
            {
                var result = await _service.GetById(id);
                if (result == null)
                {
                    _logger.LogWarning("Estimate with ID {Id} not found", id);
                    return NotFound($"Estimate with ID {id} not found");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting estimate with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the estimate");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] Estimate estimate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(estimate);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving estimate");
                return StatusCode(500, "An error occurred while saving the estimate");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Estimate>> Update(int id, [FromBody] Estimate estimate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _service.Update(id, estimate);
                if (result == null)
                {
                    return NotFound($"Estimate with ID {id} not found");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating estimate with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the estimate");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _service.Delete(id);
                if (!result)
                {
                    return NotFound($"Estimate with ID {id} not found");
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting estimate with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the estimate");
            }
        }
    }
}