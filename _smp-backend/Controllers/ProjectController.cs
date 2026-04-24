
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Services;
using SMP.Models;
using System.Security.Cryptography;
using static System.Net.Mime.MediaTypeNames;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ProjectController : ControllerBase
    {
         private readonly IProjectService _projectService;
        private readonly ILogger<ProjectController> _logger;

        public ProjectController(IProjectService projectService, ILogger<ProjectController> logger)
        {
            _projectService = projectService ?? throw new ArgumentNullException(nameof(projectService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> Projects()
        {
            try
            {
                var pj = await _projectService.Projects();
                if (pj == null)
                {
                    _logger.LogWarning("No Projects found or the result is empty");
                    return NotFound(new { Message = "No data found", Projects = new List<object>() });
                }
                if (pj.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more Projects have null Active field");
                }
                return Ok(pj);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Projects");
                return StatusCode(500, "An error occurred while retrieving projects.");
            }
        }

        [HttpGet("contract")]
        public async Task<IActionResult> ProjectsxContract(int contrato)
        {
            try
            {
                var projectExists = await _projectService.GetProjectsxContract(contrato);
                if (projectExists == null || projectExists.Count == 0)
                {
                    _logger.LogWarning("No Projects found or the result is empty");
                    return NotFound(new { Message = "No data found", Project = new List<object>() });
                }
                return Ok(projectExists);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if Project exists");
                return StatusCode(500, "An error occurred while checking if Project exists");
            }
        }
        
        [HttpGet("company")]
        public async Task<IActionResult> ProjectsxCompany(int idCompany)
        {
            try
            {
                var projects = await _projectService.GetProjectsxCompany(idCompany);
                if (projects == null || projects.Count == 0)
                {
                    _logger.LogWarning("No se encontraron proyectos para la compañía con ID {IdCompany}", idCompany);
                    return NotFound(new { Message = "No se encontraron datos", Projects = new List<object>() });
                }
                return Ok(projects);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener los proyectos de la compañía con ID {IdCompany}", idCompany);
                return StatusCode(500, "Ocurrió un error al obtener los proyectos de la compañía");
            }
        }
        
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProjectById(int id)
        {
            try
            {
                var project = await _projectService.GetProjectById(id);
                if (project == null)
                {
                    _logger.LogWarning("Project not found with ID {Id}", id);
                    return NotFound(new { Message = "Project not found", Id = id });
                }
                return Ok(project);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Project with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the Project.");
            }
        }

      
        [HttpPost]
        [ProducesResponseType(typeof(Project), StatusCodes.Status200OK)]
        [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
        [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> AddProject(Project project)
        {
            var result = await _projectService.addProject(project);
            if (result.Success)
            {
                //return Ok(result.Data);
                return Ok(new { Message = "Record New with Id", id = project.Id, Proyecto = project });
            }
            else
            {
                _logger.LogError(result.ErrorMessage, "Error saving Project");
                return BadRequest(new ErrorResponse { Message = result.ErrorMessage }); 
            }
        }


        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Project project)
        {
          
            try
            {
                var updatedProject = await _projectService.Update(id, project);
                if (updatedProject == null)
                {
                    return NotFound();
                }
                return Ok(updatedProject);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Project with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Project.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            
            try
            {
                var success = await _projectService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id = id });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Projects with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Projects");
            }
        }

        public class ErrorResponse
        {
            public string Message { get; set; }
        }

    }
}