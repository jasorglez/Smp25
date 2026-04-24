using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class WorkprogramApuFactorController : ControllerBase
    {
        private readonly IWorkprogramApuFactorService _service;
        private readonly ILogger<WorkprogramApuFactorController> _logger;

        public WorkprogramApuFactorController(IWorkprogramApuFactorService service, ILogger<WorkprogramApuFactorController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>GET api/WorkprogramApuFactor?idContract=123</summary>
        [HttpGet]
        public async Task<ActionResult<List<WorkprogramApuFactor>>> GetByContract(int idContract)
        {
            try
            {
                var data = await _service.GetByContract(idContract);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving APU factors for contract {Id}", idContract);
                return StatusCode(500, "Error al obtener los factores APU");
            }
        }

        [HttpPost]
        public async Task<ActionResult<WorkprogramApuFactor>> Create([FromBody] WorkprogramApuFactor factor)
        {
            try
            {
                factor.Id = 0;
                var saved = await _service.Save(factor);
                return CreatedAtAction(nameof(GetByContract), new { idContract = saved.IdContract }, saved);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating APU factor");
                return StatusCode(500, "Error al crear el factor APU");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<WorkprogramApuFactor>> Update(int id, [FromBody] WorkprogramApuFactor factor)
        {
            try
            {
                var updated = await _service.Update(id, factor);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating APU factor {Id}", id);
                return StatusCode(500, "Error al actualizar el factor APU");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _service.Delete(id);
                if (!success) return NotFound(new { Message = "Factor no encontrado", id });
                return Ok(new { Message = "Eliminado", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting APU factor {Id}", id);
                return StatusCode(500, "Error al eliminar el factor APU");
            }
        }
    }
}
