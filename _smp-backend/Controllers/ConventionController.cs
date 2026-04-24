using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ConventionController : ControllerBase
    {
        private readonly IConventionService _conventionService;
        private readonly ILogger _logger;

        public ConventionController(IConventionService conventionService, ILogger<ConventionController> logger)
        {
            _conventionService = conventionService ?? throw new ArgumentNullException(nameof(conventionService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> Convention()
        {
            try
            {
                var oi = await _conventionService.Get();
                if (oi == null || !oi.Any())
                {
                    _logger.LogWarning("No Convention found or the result is empty");
                    return NotFound(new { Message = "No data found", Convention = new List<object>() });
                }
                if (oi.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more Conventions have null Active field");
                }
                return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Conventions");
                return StatusCode(500, "An error occurred while retrieving Conventions.");
            }
        }

        [HttpGet("2fields/idContract")]
        public async Task<ActionResult<List<object>>> Convention2field(int idContract)
        {
            try
            {
                var oi = await _conventionService.Convention2fields(idContract);
                if (oi == null || !oi.Any())
                {
                    _logger.LogWarning("No Convention found or the result is empty");
                    return NotFound(new { Message = "No data found", Convention = new List<object>() });
                }
                               return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Conventions");
                return StatusCode(500, "An error occurred while retrieving Conventions.");
            }
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

            var result = await _conventionService.GetCP(id, tipo);
            return Ok(result);
        }

        [HttpGet("vigente/{idContract:int}")]
        public async Task<IActionResult> GetVigente(int idContract)
        {
            try
            {
                var convention = await _conventionService.GetVigente(idContract);
                if (convention == null) return Ok(null);
                return Ok(new { id = convention.Id, name = convention.Name });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vigente convention for contract {IdContract}", idContract);
                return StatusCode(500, "An error occurred while retrieving the vigente convention.");
            }
        }

        [HttpGet("vigente/{type}/{id:int}")]
        public async Task<IActionResult> GetVigenteByType(string type, int id)
        {
            try
            {
                Convention? convention = null;
                if (type.Equals("Contract", StringComparison.OrdinalIgnoreCase))
                    convention = await _conventionService.GetVigente(id);
                else if (type.Equals("Project", StringComparison.OrdinalIgnoreCase))
                    convention = await _conventionService.GetVigenteByProject(id);
                else
                    return BadRequest("El tipo debe ser 'Contract' o 'Project'.");

                if (convention == null) return Ok(null);
                return Ok(new { id = convention.Id, name = convention.Name });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vigente convention for {Type} {Id}", type, id);
                return StatusCode(500, "An error occurred while retrieving the vigente convention.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Convention co)
        {
            try
            {
                await _conventionService.Save(co);
                return Ok(new { Message = "Record New with Id", id = co.Id, advanced = co });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Advanced");
                return StatusCode(500, "An error occurred while creating Advanced");
            }
        }

        [HttpGet("idContract")]
        public async Task<ActionResult<List<object>>> ConvxCont(int id)
        {
            try
            {
                var co = await _conventionService.GetxContract(id);
                if (co == null || !co.Any())
                    {
                    _logger.LogWarning("No Convention found or the result is empty");
                    return NotFound(new { Message = "No data found", Convention = new List<object>() });
                }
                if (co.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more Conventions have null Active field");
                }
                return Ok(co);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Conventions");
                return StatusCode(500, "An error occurred while retrieving Conventions.");
            }
        }

        // Controller method
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Convention co)
        {

            try
            {
                var result = await _conventionService.Update(id, co);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Convention with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Convention.");
            }
        }


        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _conventionService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id = id });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id = id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Convention with ID ", id);
                return StatusCode(500, "An error occurred while updating Convention");
            }
        }

    }
}
