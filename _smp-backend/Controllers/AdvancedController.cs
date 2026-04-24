using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using Microsoft.AspNetCore.Authorization;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AdvancedController : ControllerBase
    {
        private readonly IAdvancedService _advancedService;
        private readonly ILogger<AdvancedController> _logger;

        public AdvancedController(IAdvancedService advancedService, ILogger<AdvancedController> logger)
        {
            _advancedService = advancedService ?? throw new ArgumentNullException(nameof(advancedService));
        }

        
        // Obtiene una lista de avances basado en el tipo (Contrato o Proyecto).
        // <param name="id">Id del contrato o proyecto</param>
        // <param name="tipo">Tipo de avance ("Contrato" o "Proyecto")</param>
        // <returns>Lista de avances</returns>
        [HttpGet("{id:int}/{tipo}")]
        public async Task<IActionResult> Get(int id, string tipo)
        {
            if (id <= 0)
            {
                return BadRequest("El ID debe ser mayor que 0.");
            }

            if (string.IsNullOrWhiteSpace(tipo) || !(tipo.Equals("Contract", StringComparison.OrdinalIgnoreCase) || tipo.Equals("Project", StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest("El tipo debe ser 'Contract' o 'Project'.");
            }

            var result = await _advancedService.Get(id, tipo);
            return Ok(result);
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Advanced ad)
        {
            try
            {
                await _advancedService.Save(ad);
                return Ok(new { Message = "Record New with Id", id = ad.Id, advanced = ad });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Advanced");
                return StatusCode(500, "An error occurred while creating Advanced");
            }
        }


        // Actualiza un avance basado en su ID.
        // <param name="id">ID del avance a actualizar</param>
        // <param name="advanced">Objeto Advanced con los datos actualizados</param>
        // <returns>Resultado de la operación</returns>
        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] Advanced advanced)
        {
            if (id <= 0 || advanced == null)
            {
                return BadRequest("Datos de actualización inválidos.");
            }

            var updated = await _advancedService.Update(id, advanced);
            if (updated)
            {
                return NoContent(); // Retorna 204 si se actualizó correctamente
            }

            return NotFound($"No se encontró un avance con ID {id}.");
        }

        
        // Elimina un avance de manera lógica cambiando su estado a inactivo.
        // <param name="id">ID del avance a eliminar</param>
        // <returns>Resultado de la operación</returns>
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            if (id <= 0)
            {
                return BadRequest("El ID debe ser mayor que 0.");
            }

            var deleted = await _advancedService.Delete(id);
            if (deleted)
            {
                return NoContent(); // Retorna 204 si la eliminación fue exitosa
            }

            return NotFound($"No se encontró un avance con ID {id}.");
        }
    }
}
