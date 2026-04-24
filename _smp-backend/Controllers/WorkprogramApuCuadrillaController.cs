using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class WorkprogramApuCuadrillaController : ControllerBase
    {
        private readonly IWorkprogramApuCuadrillaService _service;
        private readonly ILogger<WorkprogramApuCuadrillaController> _logger;

        public WorkprogramApuCuadrillaController(IWorkprogramApuCuadrillaService service, ILogger<WorkprogramApuCuadrillaController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>GET api/WorkprogramApuCuadrilla?idWorkprogram=123 — cuadrillas + items</summary>
        [HttpGet]
        public async Task<ActionResult<List<CuadrillaConItems>>> GetByWorkprogram(int idWorkprogram)
        {
            try
            {
                return Ok(await _service.GetByWorkprogram(idWorkprogram));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cuadrillas for workprogram {Id}", idWorkprogram);
                return StatusCode(500, "Error al obtener las cuadrillas");
            }
        }

        // ── Cuadrilla (header) ────────────────────────────────────────────

        [HttpPost("cuadrilla")]
        public async Task<ActionResult<WorkprogramApuCuadrilla>> CreateCuadrilla([FromBody] WorkprogramApuCuadrilla cuadrilla)
        {
            try
            {
                cuadrilla.Id = 0;
                return Ok(await _service.SaveCuadrilla(cuadrilla));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating cuadrilla");
                return StatusCode(500, "Error al crear la cuadrilla");
            }
        }

        [HttpPut("cuadrilla/{id}")]
        public async Task<ActionResult<WorkprogramApuCuadrilla>> UpdateCuadrilla(int id, [FromBody] WorkprogramApuCuadrilla cuadrilla)
        {
            try
            {
                var updated = await _service.UpdateCuadrilla(id, cuadrilla);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cuadrilla {Id}", id);
                return StatusCode(500, "Error al actualizar la cuadrilla");
            }
        }

        [HttpDelete("cuadrilla/{id}")]
        public async Task<IActionResult> DeleteCuadrilla(int id)
        {
            try
            {
                var success = await _service.DeleteCuadrilla(id);
                if (!success) return NotFound();
                return Ok(new { Message = "Cuadrilla eliminada", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting cuadrilla {Id}", id);
                return StatusCode(500, "Error al eliminar la cuadrilla");
            }
        }

        // ── Items de cuadrilla ────────────────────────────────────────────

        [HttpPost("item")]
        public async Task<ActionResult<WorkprogramApuCuadrillaItem>> CreateItem([FromBody] WorkprogramApuCuadrillaItem item)
        {
            try
            {
                item.Id = 0;
                return Ok(await _service.SaveItem(item));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating cuadrilla item");
                return StatusCode(500, "Error al crear el item");
            }
        }

        [HttpPut("item/{id}")]
        public async Task<ActionResult<WorkprogramApuCuadrillaItem>> UpdateItem(int id, [FromBody] WorkprogramApuCuadrillaItem item)
        {
            try
            {
                var updated = await _service.UpdateItem(id, item);
                if (updated == null) return NotFound();
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cuadrilla item {Id}", id);
                return StatusCode(500, "Error al actualizar el item");
            }
        }

        [HttpDelete("item/{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            try
            {
                var success = await _service.DeleteItem(id);
                if (!success) return NotFound();
                return Ok(new { Message = "Item eliminado", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting cuadrilla item {Id}", id);
                return StatusCode(500, "Error al eliminar el item");
            }
        }
    }
}
