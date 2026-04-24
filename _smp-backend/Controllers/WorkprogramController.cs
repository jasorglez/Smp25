using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class WorkprogramController : ControllerBase
    {
        private readonly IWorkprogramService _workprogramService;        
        private readonly ILogger<WorkprogramController> _logger;
    

    public WorkprogramController(IWorkprogramService workprogramService, ILogger<WorkprogramController> logger)
    {
          _workprogramService = workprogramService ?? throw new ArgumentNullException(nameof(workprogramService));
          _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    [HttpGet("idProject")]
    public async Task<ActionResult<List<Workprogram>>> Work(int idProject)
    {
        try
        {
            var add = await _workprogramService.Get(idProject);
            if (add == null || add.Count == 0)
            {
                _logger.LogWarning("No Workprogram found or the result is empty");
                return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
            }
            return Ok(add);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Workoprogram for company");
            return StatusCode(500, "An error occurred while retrieving Workprogram");
        }
    }

     // Obtiene una lista de avances basado en el tipo (Contrato o Proyecto).
     // <param name="id">Id del contrato o proyecto</param>
     // <param name="tipo">Tipo de avance ("Contrato" o "Proyecto")</param>
     // <returns>Lista de avances</returns>
     [HttpGet("{id:int}")]
     [HttpGet("{id:int}/{tipo}")]
     public async Task<IActionResult> Get(int id, string? tipo = null)
        {
            if (id <= 0)
            {
                return BadRequest("El ID debe ser mayor que 0.");
            }

            if (!string.IsNullOrEmpty(tipo) && !(tipo.Equals("Contract", StringComparison.OrdinalIgnoreCase) || tipo.Equals("Project", StringComparison.OrdinalIgnoreCase)))
            {
                return BadRequest("Type should be 'Contract' o 'Project'.");
            }

            var result = await _workprogramService.Get(id, tipo);
            return Ok(result);
    }

    [HttpGet("2fields")]
    public async Task<ActionResult<List<object>>> wp2fields(int idProject)
    {
        try
        {
            var fields = await _workprogramService.wk2fields(idProject);
            if (fields == null || fields.Count == 0)
            {
                _logger.LogWarning("No Workprogram found or the result is empty");
                return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
            }
            return Ok(fields);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving workprogram for company");
            return StatusCode(500, "An error occurred while retrieving Workprogram");
        }
    }

        [HttpGet("onlyactivities")]
        public async Task<ActionResult<List<object>>> onlyActivities(int idProject)
        {
            try
            {
                var fields = await _workprogramService.OnlyActivity(idProject);
                if (fields == null || fields.Count == 0)
                {
                    _logger.LogWarning("No Workprogram found or the result is empty");
                    return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
                }
                return Ok(fields);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving workprogram for company");
                return StatusCode(500, "An error occurred while retrieving Workprogram");
            }
        }

        [HttpGet("onlyfathers")]
        public async Task<ActionResult<List<object>>> onlyFathers(int idProject)
        {
            try
            {
                var fields = await _workprogramService.OnlyFathers(idProject);
                if (fields == null || fields.Count == 0)
                {
                    _logger.LogWarning("No Workprogram found or the result is empty");
                    return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
                }
                return Ok(fields);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving workprogram for company");
                return StatusCode(500, "An error occurred while retrieving Workprogram");
            }
        }

        [HttpPost("copy-convention")]
        public async Task<IActionResult> CopyConvention([FromBody] CopyConventionRequest request)
        {
            if (request.SourceConventionId <= 0 || request.TargetConventionId <= 0)
                return BadRequest("Los IDs de convenio deben ser mayores que 0.");

            if (request.SourceConventionId == request.TargetConventionId)
                return BadRequest("El convenio origen y destino deben ser diferentes.");

            try
            {
                var count = await _workprogramService.CopyFromConvention(request.SourceConventionId, request.TargetConventionId, request.IdProject);
                return Ok(new { copied = count, message = $"{count} tareas copiadas del convenio {request.SourceConventionId} al convenio {request.TargetConventionId}." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error copying convention workprogram");
                return StatusCode(500, "Error al copiar el programa de trabajo.");
            }
        }

        [HttpGet("byconvention")]
        public async Task<ActionResult<List<Workprogram>>> ByConvention(int idConvention, int? idProject = null)
        {
            try
            {
                var data = await _workprogramService.GetByConvention(idConvention, idProject);
                return Ok(data ?? new List<Workprogram>());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Workprogram by convention {IdConvention} project {IdProject}", idConvention, idProject);
                return StatusCode(500, "An error occurred while retrieving Workprogram");
            }
        }

        [HttpGet("concepts-hierarchy")]
        public async Task<ActionResult<List<WorkprogramConceptSystemDto>>> ConceptsHierarchy(int idProject, int? idConvention = null)
        {
            try
            {
                var data = await _workprogramService.GetConceptsHierarchy(idProject, idConvention);
                if (data == null || data.Count == 0)
                {
                    _logger.LogWarning("No Workprogram hierarchy found or the result is empty");
                    return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
                }
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving workprogram concept hierarchy");
                return StatusCode(500, "An error occurred while retrieving Workprogram");
            }
        }

        [HttpGet("concepts-subpartidas")]
        public async Task<ActionResult<List<WorkprogramConceptSubpartidaDto>>> ConceptsSubpartidas(int idProject)
        {
            try
            {
                var data = await _workprogramService.GetConceptsBySubpartida(idProject);
                if (data == null || data.Count == 0)
                {
                    _logger.LogWarning("No Workprogram subpartidas found or the result is empty");
                    return NotFound(new { Message = "No data found", Workprogram = new List<object>() });
                }
                return Ok(data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving workprogram concepts by subpartida");
                return StatusCode(500, "An error occurred while retrieving Workprogram");
            }
        }
        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Workprogram wp)
        {
            try
            {
                // Ensure Id is 0
                wp.Id = 0;
                var savedWp = await _workprogramService.Save(wp);
                return CreatedAtAction(nameof(Work), new { idProject = savedWp.IdProject }, savedWp);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Workprogram");
                return StatusCode(500, "An error occurred while creating Workprogram");
            }
        }

        [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Workprogram wp)
    {

        try
        {
            var updated = await _workprogramService.Update(id, wp);
            if (updated == null)
            {
                return NotFound();
            }
            return Ok(updated);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Workprogram with ID {Id}", id);
            return StatusCode(500, "An error occurred while updating the Workprogram.");
        }
    }

    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Delete(int id)
    {

        try
        {
            var success = await _workprogramService.Delete(id);
            if (success)
            {
                return Ok(new { Message = "Delete Record with Id", id });
            }
            else
            {
                return NotFound(new { Message = "Record Not Found with Id", id });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Workprogram with ID {Id}", id);
            return StatusCode(500, "An error occurred while updating Workprogram");
        }
    }

}
}


