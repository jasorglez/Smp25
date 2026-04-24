using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DocumentosComprobadosController : ControllerBase
    {
        private readonly IDocumentoscomprobadosService _service;
        private readonly ILogger<DocumentosComprobadosController> _logger;

        public DocumentosComprobadosController(IDocumentoscomprobadosService service, ILogger<DocumentosComprobadosController> logger)
        {
            _service = service;
            _logger = logger;
        }

        /// <summary>
        /// Obtiene todos los detalles de un concepto específico
        /// </summary>
        /// <param name="id">ID del concepto (ConceptsxIncorExp)</param>
        [HttpGet("concept/{id}")]
        public async Task<IActionResult> GetByIE(int id)
        {
            try
            {
                var details = await _service.GetByIE(id);
                return Ok(details);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving details for concept ID {Id}", id);
                return StatusCode(500, "Internal server error");
            }
        }


        /// <summary>
        /// Obtiene todos los detalles activos
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var details = await _service.GetAll();
                return Ok(details);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all details");
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Crea un nuevo detalle
        /// </summary>
        /// <param name="detail">Datos del detalle a crear</param>
        [HttpPost]
        public async Task<IActionResult> Save([FromBody] DocumentsComprobados doc)
        {
            try
            {
                await _service.Save(doc);
                return Ok(new { Message = "Record New with Id", Catalog = doc });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Catalog");
                return StatusCode(500, "An error occurred while creating the Catalog");
            }
        }

        /// <summary>
        /// Actualiza un detalle existente
        /// </summary>
        /// <param name="id">ID del detalle a actualizar</param>
        /// <param name="detail">Nuevos datos del detalle</param>
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DocumentsComprobados detail)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var updatedDetail = await _service.Update(id, detail);
                if (updatedDetail == null) return NotFound();
                return Ok(updatedDetail);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating detail with ID {Id}", id);
                return StatusCode(500, "Internal server error");
            }
        }

        /// <summary>
        /// Elimina (desactiva) un detalle
        /// </summary>
        /// <param name="id">ID del detalle a eliminar</param>
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _service.Delete(id);
                if (!result) return NotFound();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting detail with ID {Id}", id);
                return StatusCode(500, "Internal server error");
            }
        }
    }
}
