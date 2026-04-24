
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
    public class GeneratorsController : ControllerBase
    {
        private readonly IGeneratorService _service;
        private readonly ILogger<GeneratorsController> _logger;

        public GeneratorsController(IGeneratorService service, ILogger<GeneratorsController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetGenerators(int idEstimacion)
        {
            try
            {
                var result = await _service.GetGenerators(idEstimacion);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Generators found for estimacion {IdEstimacion}", idEstimacion);
                    return NotFound(new { Message = "No data found", Generators = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting generators for estimacion {IdEstimacion}", idEstimacion);
                return StatusCode(500, "An error occurred while retrieving the generators");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] Generator generator)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(generator);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving generator");
                return StatusCode(500, "An error occurred while saving the generator");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Generator>> Update(int id, [FromBody] Generator generator)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _service.Update(id, generator);
                if (result == null)
                {
                    return NotFound($"Generator with ID {id} not found");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating generator with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the generator");
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
                    return NotFound($"Generator with ID {id} not found");
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting generator with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the generator");
            }
        }
    }
}