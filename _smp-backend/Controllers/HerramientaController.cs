using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class HerramientaController : ControllerBase
    {
        private readonly IHerramientaService _service;
        private readonly ILogger<HerramientaController> _logger;

        public HerramientaController(IHerramientaService service, ILogger<HerramientaController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("company/{companyId}")]
        public async Task<IActionResult> GetByCompany(int companyId)
        {
            if (companyId <= 0) return BadRequest("Company ID must be greater than 0.");
            try
            {
                var result = await _service.GetByCompany(companyId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Herramientas for company {CompanyId}", companyId);
                return StatusCode(500, "Error retrieving Herramientas.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Herramienta herramienta)
        {
            try
            {
                await _service.Save(herramienta);
                return Ok(new { Message = "Herramienta created successfully", id = herramienta.Id, herramienta });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Herramienta");
                return StatusCode(500, "Error creating Herramienta.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Herramienta herramienta)
        {
            try
            {
                var result = await _service.Update(id, herramienta);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Herramienta {Id}", id);
                return StatusCode(500, "Error updating Herramienta.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _service.Delete(id);
                if (success) return Ok(new { Message = "Herramienta deleted successfully", id });
                return NotFound(new { Message = "Herramienta not found", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Herramienta {Id}", id);
                return StatusCode(500, "Error deleting Herramienta.");
            }
        }
    }
}
