using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class GrallogController : ControllerBase
    {
        private readonly IGrallogService _grallogService;
        private readonly ILogger<GrallogController> _logger;

        public GrallogController(IGrallogService grallogService, ILogger<GrallogController> logger)
        {
            _grallogService = grallogService ?? throw new ArgumentNullException(nameof(grallogService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<IActionResult> GetGrallogs(int idProject)
        {
            try
            {
                var grallogs = await _grallogService.GrallogsxProject(idProject);
                if (grallogs==null ||grallogs.Count==0)
                {
                    _logger.LogWarning("No General Log or the result is empty");
                    return NotFound(new { Message = "No data found", Grallog = new List<object>() });
                }
                return Ok(grallogs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Grallogs for project {IdProject}", idProject);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }


        [HttpGet("datelog")]
        public async Task<IActionResult> GetGraldate(DateTime datelog)
        {
            try
            {
                var gral = await _grallogService.GrallogsxDate(datelog);
                if (gral == null || !gral.Any())
                {
                    _logger.LogWarning("No General Log or the result is empty");
                    return NotFound(new { Message = "No data found", Grallog = new List<object>() });
                }
                return Ok(gral);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Grallogs for project {Date}", datelog);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<IActionResult> PostGrallog([FromBody] Grallog grallog)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _grallogService.Save(grallog);
                return CreatedAtAction(nameof(GetGrallogs), new { idProject = grallog.IdProject }, grallog);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving Grallog");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutGrallog(int id, [FromBody] Grallog grallog)
        {
            if (id != grallog.Id)
            {
                return BadRequest("The ID in the URL does not match the ID in the body.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedGrallog = await _grallogService.Update(id, grallog);
                if (updatedGrallog == null)
                {
                    return NotFound($"Grallog with ID {id} not found.");
                }
                return Ok(updatedGrallog);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Grallog with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteGrallog(int id)
        {
            try
            {
                var result = await _grallogService.Delete(id);
                if (!result)
                {
                    return NotFound($"Grallog with ID {id} not found.");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Grallog with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}