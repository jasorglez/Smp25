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
    public class MonedaController : ControllerBase
    {
        private readonly IMonedaService _monedaService;
        private readonly ILogger<MonedaController> _logger;

        public MonedaController(IMonedaService monedaService, ILogger<MonedaController> logger)
        {
            _monedaService = monedaService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetMoneda()
        {
            try
            {
                var moneda = await _monedaService.GetMoneda();

                if (moneda == null || moneda.Count == 0)
                {
                    _logger.LogWarning("No Moneda found or the result is empty");
                    return NotFound(new { Message = "No Moneda found or the result is empty", Moneda = new List<object>() });
                }
                return Ok(moneda);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Moneda");
                return StatusCode(500, "An error occurred while retrieving Moneda.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var moneda = await _monedaService.Get2fields();

                if (moneda == null || moneda.Count == 0)
                {
                    _logger.LogWarning("No Moneda found or the result is empty");
                    return NotFound(new { Message = "No Moneda found or the result is empty", Moneda = new List<object>() });
                }
                return Ok(moneda);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Moneda fields");
                return StatusCode(500, "An error occurred while retrieving Moneda.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetMonedaById(int id)
        {
            var moneda = await _monedaService.GetMonedaById(id);
            return Ok(moneda);
        }

        [HttpPost]
        public async Task<IActionResult> CreateMoneda([FromBody] Moneda moneda)
        {
            var createdMoneda = await _monedaService.CreateMoneda(moneda);
            return Ok(createdMoneda);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Moneda moneda)
        {
            if (id != moneda.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedMoneda = await _monedaService.Update(id, moneda);
                if (updatedMoneda == null)
                {
                    return NotFound();
                }
                return Ok(updatedMoneda);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Moneda with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Moneda.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _monedaService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}