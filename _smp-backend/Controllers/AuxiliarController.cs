using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AuxiliarController : ControllerBase
    {
        private readonly IAuxiliarService _service;
        private readonly ILogger<AuxiliarController> _logger;

        public AuxiliarController(IAuxiliarService service, ILogger<AuxiliarController> logger)
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
                _logger.LogError(ex, "Error retrieving Auxiliares for company {CompanyId}", companyId);
                return StatusCode(500, "Error retrieving Auxiliares.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Auxiliar auxiliar)
        {
            try
            {
                await _service.Save(auxiliar);
                return Ok(new { Message = "Auxiliar created successfully", id = auxiliar.Id, auxiliar });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Auxiliar");
                return StatusCode(500, "Error creating Auxiliar.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Auxiliar auxiliar)
        {
            try
            {
                var result = await _service.Update(id, auxiliar);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Auxiliar {Id}", id);
                return StatusCode(500, "Error updating Auxiliar.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _service.Delete(id);
                if (success) return Ok(new { Message = "Auxiliar deleted successfully", id });
                return NotFound(new { Message = "Auxiliar not found", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Auxiliar {Id}", id);
                return StatusCode(500, "Error deleting Auxiliar.");
            }
        }
    }
}
