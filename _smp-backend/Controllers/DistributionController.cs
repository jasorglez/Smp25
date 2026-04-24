using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class DistributionController : ControllerBase
    {
        private readonly IDistributionService _service;
        private readonly ILogger<DistributionController> _logger;

        public DistributionController(IDistributionService service, ILogger<DistributionController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpGet("{type}/{idReference}/{idCompany}")]
        public async Task<IActionResult> GetByReference(string type, int idReference, int idCompany)
        {
            var result = await _service.GetByReference(idReference, type, idCompany);
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Distribution distribution)
        {
            try
            {
                await _service.Save(distribution);
                return Ok(new { Message = "Distribution created", id = distribution.Id, distribution });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Distribution");
                return StatusCode(500, "An error occurred while creating Distribution");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Distribution distribution)
        {
            try
            {
                var result = await _service.Update(id, distribution);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Distribution with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Distribution");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _service.Delete(id);
                if (!result) return NotFound();
                return Ok(new { Message = "Distribution deleted", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Distribution with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting Distribution");
            }
        }
    }
}
