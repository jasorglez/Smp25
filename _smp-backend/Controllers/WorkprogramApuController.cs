using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class WorkprogramApuController : ControllerBase
    {
        private readonly IWorkprogramApuService _service;
        private readonly ILogger<WorkprogramApuController> _logger;

        public WorkprogramApuController(IWorkprogramApuService service, ILogger<WorkprogramApuController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>GET api/WorkprogramApu?idWorkprogram=123 — todos los ítems APU de un concepto</summary>
        [HttpGet]
        public async Task<ActionResult<List<WorkprogramApu>>> GetByWorkprogram(int idWorkprogram)
        {
            try
            {
                var data = await _service.GetByWorkprogram(idWorkprogram);
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving APU for workprogram {Id}", idWorkprogram);
                return StatusCode(500, "Error al obtener el APU");
            }
        }

        /// <summary>GET api/WorkprogramApu/applied-total?idWorkprogram=123 — suma de totales con apply_to_cost=true</summary>
        [HttpGet("applied-total")]
        public async Task<ActionResult<decimal>> GetAppliedTotal(int idWorkprogram)
        {
            try
            {
                var total = await _service.GetAppliedTotal(idWorkprogram);
                return Ok(total);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating applied total for workprogram {Id}", idWorkprogram);
                return StatusCode(500, "Error al calcular el total");
            }
        }

        [HttpPost]
        public async Task<ActionResult<WorkprogramApu>> Create([FromBody] WorkprogramApu apu)
        {
            try
            {
                apu.Id = 0;
                var saved = await _service.Save(apu);
                return CreatedAtAction(nameof(GetByWorkprogram), new { idWorkprogram = saved.IdWorkprogram }, saved);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating APU");
                return StatusCode(500, "Error al crear el ítem APU");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<WorkprogramApu>> Update(int id, [FromBody] WorkprogramApu apu)
        {
            try
            {
                var updated = await _service.Update(id, apu);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating APU {Id}", id);
                return StatusCode(500, "Error al actualizar el ítem APU");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _service.Delete(id);
                if (!success) return NotFound(new { Message = "Registro no encontrado", id });
                return Ok(new { Message = "Eliminado", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting APU {Id}", id);
                return StatusCode(500, "Error al eliminar el ítem APU");
            }
        }
    }
}
