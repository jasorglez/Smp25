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
    public class MetodoPagoController : ControllerBase
    {
        private readonly IMetodoPagoService _metodoPagoService;
        private readonly ILogger<MetodoPagoController> _logger;

        public MetodoPagoController(IMetodoPagoService metodoPagoService, ILogger<MetodoPagoController> logger)
        {
            _metodoPagoService = metodoPagoService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetMetodoPago()
        {
            try
            {
                var metodoPago = await _metodoPagoService.GetMetodoPago();

                if (metodoPago == null || metodoPago.Count == 0)
                {
                    _logger.LogWarning("No MetodoPago found or the result is empty");
                    return NotFound(new { Message = "No MetodoPago found or the result is empty", MetodoPago = new List<object>() });
                }
                return Ok(metodoPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving MetodoPago");
                return StatusCode(500, "An error occurred while retrieving MetodoPago.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var metodoPago = await _metodoPagoService.Get2fields();

                if (metodoPago == null || metodoPago.Count == 0)
                {
                    _logger.LogWarning("No MetodoPago found or the result is empty");
                    return NotFound(new { Message = "No MetodoPago found or the result is empty", MetodoPago = new List<object>() });
                }
                return Ok(metodoPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving MetodoPago fields");
                return StatusCode(500, "An error occurred while retrieving MetodoPago.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMetodoPagoById(int id)
        {
            var metodoPago = await _metodoPagoService.GetMetodoPagoById(id);
            return Ok(metodoPago);
        }

        [HttpPost]
        public async Task<IActionResult> CreateMetodoPago([FromBody] MetodoPago metodoPago)
        {
            var createdMetodoPago = await _metodoPagoService.CreateMetodoPago(metodoPago);
            return Ok(createdMetodoPago);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] MetodoPago metodoPago)
        {
            if (id != metodoPago.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedMetodoPago = await _metodoPagoService.Update(id, metodoPago);
                if (updatedMetodoPago == null)
                {
                    return NotFound();
                }
                return Ok(updatedMetodoPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating MetodoPago with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the MetodoPago.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _metodoPagoService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}