using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;


namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class ChangescontrolController : ControllerBase
    {
        private readonly IChangesControlService _changesControlService;
        private readonly ILogger<ChangescontrolController> _logger;

        public ChangescontrolController(IChangesControlService changesControlService, ILogger<ChangescontrolController> logger)
        {
            _changesControlService = changesControlService ?? throw new ArgumentNullException(nameof(changesControlService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> GetByProject(int idProject, DateTime date)
        {
            try
            {
                var result = await _changesControlService.ChangesControlxProject(idProject, date);
                if (result == null || !result.Any())
                {
                    _logger.LogWarning("No Changescontrol found or the result is empty");
                    return NotFound(new { Message = "No data found", Changescontrol = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting changes control by project");
                return StatusCode(500, "Internal server error while retrieving changes control");
            }
        }

        [HttpGet("date")]
        public async Task<ActionResult<List<object>>> GetByDate(DateTime date)
        {
            try
            {
                var result = await _changesControlService.ChangesControlxDate(date);
                   if (result == null || !result.Any())
                {
                    _logger.LogWarning("No Changescontrol found or the result is empty");
                    return NotFound(new { Message = "No data found", Changescontrol = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting changes control by date");
                return StatusCode(500, "Internal server error while retrieving changes control");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Post(Changescontrol changesControl)
        {
            try
            {
                await _changesControlService.Save(changesControl);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving changes control");
                return StatusCode(500, "Internal server error while saving changes control");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Changescontrol>> Put(int id, Changescontrol changesControl)
        {
            try
            {
                var result = await _changesControlService.Update(id, changesControl);
                if (result == null)
                    return NotFound();

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating changes control");
                return StatusCode(500, "Internal server error while updating changes control");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _changesControlService.Delete(id);
                if (!result)
                    return NotFound();

                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting changes control");
                return StatusCode(500, "Internal server error while deleting changes control");
            }
        }
    }
}