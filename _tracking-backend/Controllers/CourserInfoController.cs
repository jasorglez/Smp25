using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CourserInfoController : ControllerBase
    {
        private readonly ICourserInfoService _service;
        private readonly ILogger<CourserInfoController> _logger;

        public CourserInfoController(ICourserInfoService service, ILogger<CourserInfoController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<CourserInfo>>> GetAll()
        {
            try
            {
                var CourserInfo = await _service.GetAll();
                if (CourserInfo == null || CourserInfo.Count == 0)
                {
                    _logger.LogWarning("No CourserInfo found");
                    return NotFound(new { Message = "No data found", CourserInfo = new List<Bank>() });
                }
                return Ok(CourserInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CourserInfo");
                return StatusCode(500, "An error occurred while retrieving the CourserInfo");
            }
        }

        

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] CourserInfo courserInfo)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(courserInfo);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving courserInfo");
                return StatusCode(500, "An error occurred while saving the courserInfo");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<CourserInfo>> Update(int id, [FromBody] CourserInfo courserInfo)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedCourserInfo = await _service.Update(id, courserInfo);
                if (updatedCourserInfo == null)
                {
                    return NotFound($"CourserInfo with ID {id} not found");
                }
                return Ok(updatedCourserInfo);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating CourserInfo with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the CourserInfo");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _service.Delete(id);
                if (!result)
                {
                    return NotFound($"Bank with ID {id} not found");
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the bank");
            }
        }
    }
}
