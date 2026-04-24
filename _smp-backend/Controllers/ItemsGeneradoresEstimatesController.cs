
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
    public class ItemsGeneradoresEstimatesController : ControllerBase
    {
        private readonly IItemsGeneradoresEstimateService _service;
        private readonly ILogger<ItemsGeneradoresEstimatesController> _logger;

        public ItemsGeneradoresEstimatesController(IItemsGeneradoresEstimateService service, ILogger<ItemsGeneradoresEstimatesController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetItemsGeneradoresEstimates(int idType, string Type)
        {
            try
            {
                var result = await _service.GetItemsGeneradoresEstimates(idType, Type);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No ItemsGeneradoresEstimates found for resource {IdResource}", idType);
                    return NotFound(new { Message = "No data found", ItemsGeneradoresEstimates = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting items generadores estimates for resource {IdResource}", idType);
                return StatusCode(500, "An error occurred while retrieving the items generadores estimates");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] ItemsGeneradoresEstimate itemsGeneradoresEstimate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(itemsGeneradoresEstimate);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving items generadores estimate");
                return StatusCode(500, "An error occurred while saving the items generadores estimate");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ItemsGeneradoresEstimate>> Update(int id, [FromBody] ItemsGeneradoresEstimate itemsGeneradoresEstimate)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _service.Update(id, itemsGeneradoresEstimate);
                if (result == null)
                {
                    return NotFound($"ItemsGeneradoresEstimate with ID {id} not found");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating items generadores estimate with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the items generadores estimate");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id, string Type)
        {
            try
            {
                var result = await _service.Delete(id, Type);
                if (!result)
                {
                    return NotFound($"ItemsGeneradoresEstimate with ID {id} not found");
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting items generadores estimate with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the items generadores estimate");
            }
        }
    }
}