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
    public class ObjetoImpuestoController : ControllerBase
    {
        private readonly IObjetoImpuestoService _objetoImpuestoService;
        private readonly ILogger<ObjetoImpuestoController> _logger;

        public ObjetoImpuestoController(IObjetoImpuestoService objetoImpuestoService, ILogger<ObjetoImpuestoController> logger)
        {
            _objetoImpuestoService = objetoImpuestoService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetObjetoImpuesto()
        {
            try
            {
                var objetoImpuesto = await _objetoImpuestoService.GetObjetoImpuesto();

                if (objetoImpuesto == null || objetoImpuesto.Count == 0)
                {
                    _logger.LogWarning("No ObjetoImpuesto found or the result is empty");
                    return NotFound(new { Message = "No ObjetoImpuesto found or the result is empty", ObjetoImpuesto = new List<object>() });
                }
                return Ok(objetoImpuesto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoImpuesto");
                return StatusCode(500, "An error occurred while retrieving ObjetoImpuesto.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var objetoImpuesto = await _objetoImpuestoService.Get2fields();

                if (objetoImpuesto == null || objetoImpuesto.Count == 0)
                {
                    _logger.LogWarning("No ObjetoImpuesto found or the result is empty");
                    return NotFound(new { Message = "No ObjetoImpuesto found or the result is empty", ObjetoImpuesto = new List<object>() });
                }
                return Ok(objetoImpuesto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoImpuesto fields");
                return StatusCode(500, "An error occurred while retrieving ObjetoImpuesto.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetObjetoImpuestoById(int id)
        {
            var objetoImpuesto = await _objetoImpuestoService.GetObjetoImpuestoById(id);
            return Ok(objetoImpuesto);
        }

        [HttpPost]
        public async Task<IActionResult> CreateObjetoImpuesto([FromBody] ObjetoImpuesto objetoImpuesto)
        {
            var createdObjetoImpuesto = await _objetoImpuestoService.CreateObjetoImpuesto(objetoImpuesto);
            return Ok(createdObjetoImpuesto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ObjetoImpuesto objetoImpuesto)
        {
            if (id != objetoImpuesto.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedObjetoImpuesto = await _objetoImpuestoService.Update(id, objetoImpuesto);
                if (updatedObjetoImpuesto == null)
                {
                    return NotFound();
                }
                return Ok(updatedObjetoImpuesto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ObjetoImpuesto with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the ObjetoImpuesto.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _objetoImpuestoService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}