using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using System;
using System.Threading.Tasks;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TimeinactivesController : ControllerBase
    {
        private readonly ITimeInactiveService _timeInactiveService;
        private readonly ILogger<TimeinactivesController> _logger;

        public TimeinactivesController(ITimeInactiveService timeInactiveService, ILogger<TimeinactivesController> logger)
        {
            _timeInactiveService = timeInactiveService ?? throw new ArgumentNullException(nameof(timeInactiveService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("totalxcause")]
        public async Task<IActionResult> Totalxcause()
        {
            try
            {
                var result = await _timeInactiveService.totalxcauses();
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting time inactives for area {IdArea}");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }


        [HttpGet("byReporte/{idReporte}")]
        public async Task<IActionResult> GetByReporte(int idReporte)
        {
            try
            {
                var result = await _timeInactiveService.GetByReporte(idReporte);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting time inactives for reporte {IdReporte}", idReporte);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpGet("byArea/{idArea}")]
        public async Task<IActionResult> GetByArea(int idArea)
        {
            try
            {
                var result = await _timeInactiveService.GetTimeInactives(idArea);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting time inactives for area {IdArea}", idArea);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpGet("byProject/{idProject}")]
        public async Task<IActionResult> GetByProject(int idProject, DateTime date)
        {
            try
            {
                var result = await _timeInactiveService.GetTimeInactivesForProject(idProject, date);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No TimeInactives or the result is empty");
                    return NotFound(new { Message = "No data found", Timeinactives = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting time inactives for project {IdProject}", idProject);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Timeinactive timeInactive)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _timeInactiveService.Save(timeInactive);
                return CreatedAtAction(nameof(GetByArea), new { idArea = timeInactive.IdArea }, timeInactive);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while creating time inactive");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Timeinactive timeInactive)
        {
            if (id != timeInactive.Id)
            {
                return BadRequest("The ID in the URL does not match the ID in the request body.");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedTimeInactive = await _timeInactiveService.Update(id, timeInactive);
                if (updatedTimeInactive == null)
                {
                    return NotFound();
                }
                return Ok(updatedTimeInactive);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating time inactive with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _timeInactiveService.Delete(id);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting time inactive with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}