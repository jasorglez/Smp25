using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AuxiliarItemsController : ControllerBase
    {
        private readonly IAuxiliarItemsService _service;
        private readonly ILogger<AuxiliarItemsController> _logger;

        public AuxiliarItemsController(IAuxiliarItemsService service, ILogger<AuxiliarItemsController> logger)
        {
            _service = service;
            _logger  = logger;
        }

        [HttpGet("detalle")]
        public async Task<IActionResult> GetDetalle(int idAuxiliar)
        {
            try { return Ok(await _service.GetDetalle(idAuxiliar)); }
            catch (Exception ex) { _logger.LogError(ex, "Error GetDetalle {Id}", idAuxiliar); return StatusCode(500, "Error al obtener detalle."); }
        }

        [HttpPost("item")]
        public async Task<IActionResult> SaveItem([FromBody] AuxiliarItem item)
        {
            try { return Ok(await _service.SaveItem(item)); }
            catch (Exception ex) { _logger.LogError(ex, "Error SaveItem"); return StatusCode(500, "Error al guardar item."); }
        }

        [HttpPut("item/{id}")]
        public async Task<IActionResult> UpdateItem(int id, [FromBody] AuxiliarItem item)
        {
            try { return await _service.UpdateItem(id, item) ? NoContent() : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error UpdateItem {Id}", id); return StatusCode(500, "Error al actualizar item."); }
        }

        [HttpDelete("item/{id}")]
        public async Task<IActionResult> DeleteItem(int id)
        {
            try { return await _service.DeleteItem(id) ? Ok(new { id }) : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error DeleteItem {Id}", id); return StatusCode(500, "Error al eliminar item."); }
        }

        [HttpPost("cuadrilla")]
        public async Task<IActionResult> SaveCuadrilla([FromBody] AuxiliarCuadrilla c)
        {
            try { return Ok(await _service.SaveCuadrilla(c)); }
            catch (Exception ex) { _logger.LogError(ex, "Error SaveCuadrilla"); return StatusCode(500, "Error al guardar cuadrilla."); }
        }

        [HttpPut("cuadrilla/{id}")]
        public async Task<IActionResult> UpdateCuadrilla(int id, [FromBody] AuxiliarCuadrilla c)
        {
            try { return await _service.UpdateCuadrilla(id, c) ? NoContent() : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error UpdateCuadrilla {Id}", id); return StatusCode(500, "Error al actualizar cuadrilla."); }
        }

        [HttpDelete("cuadrilla/{id}")]
        public async Task<IActionResult> DeleteCuadrilla(int id)
        {
            try { return await _service.DeleteCuadrilla(id) ? Ok(new { id }) : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error DeleteCuadrilla {Id}", id); return StatusCode(500, "Error al eliminar cuadrilla."); }
        }

        [HttpPost("cuadrilla-item")]
        public async Task<IActionResult> SaveCuadrillaItem([FromBody] AuxiliarCuadrillaItem item)
        {
            try { return Ok(await _service.SaveCuadrillaItem(item)); }
            catch (Exception ex) { _logger.LogError(ex, "Error SaveCuadrillaItem"); return StatusCode(500, "Error al guardar item de cuadrilla."); }
        }

        [HttpPut("cuadrilla-item/{id}")]
        public async Task<IActionResult> UpdateCuadrillaItem(int id, [FromBody] AuxiliarCuadrillaItem item)
        {
            try { return await _service.UpdateCuadrillaItem(id, item) ? NoContent() : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error UpdateCuadrillaItem {Id}", id); return StatusCode(500, "Error al actualizar item de cuadrilla."); }
        }

        [HttpDelete("cuadrilla-item/{id}")]
        public async Task<IActionResult> DeleteCuadrillaItem(int id)
        {
            try { return await _service.DeleteCuadrillaItem(id) ? Ok(new { id }) : NotFound(); }
            catch (Exception ex) { _logger.LogError(ex, "Error DeleteCuadrillaItem {Id}", id); return StatusCode(500, "Error al eliminar item de cuadrilla."); }
        }
    }
}
