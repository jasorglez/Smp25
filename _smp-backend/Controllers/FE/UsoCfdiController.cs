using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models.FE;
using SMP.Services.FE;

namespace SMP.Controllers.FE
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UsoCfdiController : ControllerBase
    {
        private readonly IUsoCfdiService _usoCfdiService;
        private readonly ILogger<UsoCfdiController> _logger;

        public UsoCfdiController(IUsoCfdiService usoCfdiService, ILogger<UsoCfdiController> logger)
        {
            _usoCfdiService = usoCfdiService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetUsoCfdi()
        {
            try
            {
                var usoCfdi = await _usoCfdiService.GetUsoCfdi();

                if (usoCfdi == null || usoCfdi.Count == 0)
                {
                    _logger.LogWarning("No UsoCfdi found or the result is empty");
                    return NotFound(new { Message = "No UsoCfdi found or the result is empty", UsoCfdi = new List<object>() });
                }
                return Ok(usoCfdi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving UsoCfdi");
                return StatusCode(500, "An error occurred while retrieving UsoCfdi.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var usoCfdi = await _usoCfdiService.Get2fields();

                if (usoCfdi == null || usoCfdi.Count == 0)
                {
                    _logger.LogWarning("No UsoCfdi found or the result is empty");
                    return NotFound(new { Message = "No UsoCfdi found or the result is empty", UsoCfdi = new List<object>() });
                }
                return Ok(usoCfdi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving UsoCfdi fields");
                return StatusCode(500, "An error occurred while retrieving UsoCfdi.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetUsoCfdiById(int id)
        {
            var usoCfdi = await _usoCfdiService.GetUsoCfdiById(id);
            return Ok(usoCfdi);
        }

        [HttpPost]
        public async Task<IActionResult> CreateUsoCfdi([FromBody] UsoCfdi usoCfdi)
        {
            var createdUsoCfdi = await _usoCfdiService.CreateUsoCfdi(usoCfdi);
            return Ok(createdUsoCfdi);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UsoCfdi usoCfdi)
        {
            if (id != usoCfdi.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedUsoCfdi = await _usoCfdiService.Update(id, usoCfdi);
                if (updatedUsoCfdi == null)
                {
                    return NotFound();
                }
                return Ok(updatedUsoCfdi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating UsoCfdi with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the UsoCfdi.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _usoCfdiService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}