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
    public class TipoComprobanteController : ControllerBase
    {
        private readonly ITipoComprobanteService _tipoComprobanteService;
        private readonly ILogger<TipoComprobanteController> _logger;

        public TipoComprobanteController(ITipoComprobanteService tipoComprobanteService, ILogger<TipoComprobanteController> logger)
        {
            _tipoComprobanteService = tipoComprobanteService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetTipoComprobante()
        {
            try
            {
                var tipoComprobante = await _tipoComprobanteService.GetTipoComprobante();

                if (tipoComprobante == null || tipoComprobante.Count == 0)
                {
                    _logger.LogWarning("No TipoComprobante found or the result is empty");
                    return NotFound(new { Message = "No TipoComprobante found or the result is empty", TipoComprobante = new List<object>() });
                }
                return Ok(tipoComprobante);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TipoComprobante");
                return StatusCode(500, "An error occurred while retrieving TipoComprobante.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var tipoComprobante = await _tipoComprobanteService.Get2fields();

                if (tipoComprobante == null || tipoComprobante.Count == 0)
                {
                    _logger.LogWarning("No TipoComprobante found or the result is empty");
                    return NotFound(new { Message = "No TipoComprobante found or the result is empty", TipoComprobante = new List<object>() });
                }
                return Ok(tipoComprobante);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TipoComprobante fields");
                return StatusCode(500, "An error occurred while retrieving TipoComprobante.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetTipoComprobanteById(int id)
        {
            var tipoComprobante = await _tipoComprobanteService.GetTipoComprobanteById(id);
            return Ok(tipoComprobante);
        }

        [HttpPost]
        public async Task<IActionResult> CreateTipoComprobante([FromBody] TipoComprobante tipoComprobante)
        {
            var createdTipoComprobante = await _tipoComprobanteService.CreateTipoComprobante(tipoComprobante);
            return Ok(createdTipoComprobante);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] TipoComprobante tipoComprobante)
        {
            if (id != tipoComprobante.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedTipoComprobante = await _tipoComprobanteService.Update(id, tipoComprobante);
                if (updatedTipoComprobante == null)
                {
                    return NotFound();
                }
                return Ok(updatedTipoComprobante);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating TipoComprobante with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the TipoComprobante.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _tipoComprobanteService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}