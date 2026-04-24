using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ManoObraController : ControllerBase
    {
        private readonly IManoObraService _service;
        private readonly ILogger<ManoObraController> _logger;

        public ManoObraController(IManoObraService service, ILogger<ManoObraController> logger)
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
                _logger.LogError(ex, "Error retrieving ManoObra for company {CompanyId}", companyId);
                return StatusCode(500, "Error retrieving ManoObra.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] ManoObra manoObra)
        {
            try
            {
                await _service.Save(manoObra);
                return Ok(new { Message = "ManoObra created successfully", id = manoObra.Id, manoObra });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ManoObra");
                return StatusCode(500, "Error creating ManoObra.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ManoObra manoObra)
        {
            try
            {
                var result = await _service.Update(id, manoObra);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ManoObra {Id}", id);
                return StatusCode(500, "Error updating ManoObra.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _service.Delete(id);
                if (success) return Ok(new { Message = "ManoObra deleted successfully", id });
                return NotFound(new { Message = "ManoObra not found", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ManoObra {Id}", id);
                return StatusCode(500, "Error deleting ManoObra.");
            }
        }
    }
}
