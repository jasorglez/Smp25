using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models.TD;
using SMP.Services.TD;

namespace SMP.Controllers.TD
{
    [Authorize]
    [ApiController]
    [Route("api/TDPersonalByProyects")]
    public class PersonalByProyectController : ControllerBase
    {
        private readonly ILogger<PersonalByProyectController> _logger;
        private readonly IPersonalByProyectService _personalByProyectService;

        public PersonalByProyectController(IPersonalByProyectService personalByProyectService, ILogger<PersonalByProyectController> logger)
        {
            _personalByProyectService = personalByProyectService ?? throw new ArgumentNullException(nameof(personalByProyectService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("{idProyect}")]
        public async Task<ActionResult<PersonalByProyect>> GetById(int idProyect)
        {
            try
            {
                var personalByProyect = await _personalByProyectService.GetPersonalByProyectById(idProyect);
                if (personalByProyect == null)
                {
                    return NotFound($"PersonalByProyect with ID {idProyect} not found");
                }
                return Ok(personalByProyect);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving concept with ID {idProyect}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("personalByProyect")]
        public async Task<ActionResult<PersonalByProyect>> GetPersonalByProyect()
        {
            try
            {
                var personalByProyect = await _personalByProyectService.GetPersonalByProyect();
                if (personalByProyect == null)
                {
                    return NotFound($"PersonalByProyect with ID  not found");
                }
                return Ok(personalByProyect);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving concept with ID ");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost]
        public async Task<ActionResult<PersonalByProyect>> Create([FromBody] PersonalByProyect personalByProyect)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var createdPersonalByProyect = await _personalByProyectService.CreatepersonalByProyect(personalByProyect);
                return Ok(createdPersonalByProyect);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating personalByProyect");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<PersonalByProyect>> Update(int id, [FromBody] PersonalByProyect personalByProyect)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var updatedPersonalByProyect = await _personalByProyectService.UpdatepersonalByProyect(id, personalByProyect);
                if (updatedPersonalByProyect == null)
                {
                    return NotFound($"PersonalByProyect with ID {id} not found");
                }

                return Ok(updatedPersonalByProyect);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating personalByProyect with ID {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _personalByProyectService.DeletepersonalByProyect(id);
                if (!result)
                {
                    return NotFound($"PersonalByProyect with ID {id} not found");
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting concept with ID {id}");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}