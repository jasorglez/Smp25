using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models.FE;
using SMP.Services.FE;

namespace SMP.Controllers.FE
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ClaveUnidadController : ControllerBase
    {
        private readonly IClaveUnidadService _claveUnidadService;
        private readonly ILogger<ClaveUnidadController> _logger;

        public ClaveUnidadController(IClaveUnidadService claveUnidadService, ILogger<ClaveUnidadController> logger)
        {
            _claveUnidadService = claveUnidadService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetClaveUnidad()
        {
            try
            {
                var claveUnidad = await _claveUnidadService.GetClaveUnidad();

                if (claveUnidad == null || claveUnidad.Count == 0)
                {
                    _logger.LogWarning("No ClaveUnidad found or the result is empty");
                    return NotFound(new { Message = "No ClaveUnidad found or the result is empty", ClaveUnidad = new List<object>() });
                }
                return Ok(claveUnidad);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveUnidad");
                return StatusCode(500, "An error occurred while retrieving ClaveUnidad.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var claveUnidad = await _claveUnidadService.Get2fields();

                if (claveUnidad == null || claveUnidad.Count == 0)
                {
                    _logger.LogWarning("No ClaveUnidad found or the result is empty");
                    return NotFound(new { Message = "No ClaveUnidad found or the result is empty", ClaveUnidad = new List<object>() });
                }
                return Ok(claveUnidad);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveUnidad fields");
                return StatusCode(500, "An error occurred while retrieving ClaveUnidad.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetClaveUnidadById(int id)
        {
            var claveUnidad = await _claveUnidadService.GetClaveUnidadById(id);
            return Ok(claveUnidad);
        }

        [HttpPost]
        public async Task<IActionResult> CreateClaveUnidad([FromBody] ClaveUnidad claveUnidad)
        {
            var createdClaveUnidad = await _claveUnidadService.CreateClaveUnidad(claveUnidad);
            return Ok(createdClaveUnidad);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ClaveUnidad claveUnidad)
        {
            if (id != claveUnidad.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedClaveUnidad = await _claveUnidadService.Update(id, claveUnidad);
                if (updatedClaveUnidad == null)
                {
                    return NotFound();
                }
                return Ok(updatedClaveUnidad);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ClaveUnidad with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the ClaveUnidad.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _claveUnidadService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}