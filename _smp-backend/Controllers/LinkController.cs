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
    public class LinkController : ControllerBase
    {
        private readonly ILinkService _linkService;
        private readonly ILogger _logger;

        public LinkController(ILinkService linkService, ILogger<LinkController> logger)
        {
            _linkService = linkService ?? throw new ArgumentNullException(nameof(LinkService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }


        [HttpGet]
        public async Task<ActionResult<List<object>>> Get()
        {
            try
            {
                var oi = await _linkService.Get();
                if (oi == null || !oi.Any())
                {
                    _logger.LogWarning("No Link found or the result is empty");
                    return NotFound(new { Message = "No data found", Link = new List<object>() });
                }
                if (oi.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more Link have null Active field");
                }
                return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Links");
                return StatusCode(500, "An error occurred while retrieving Links.");
            }
        }


        [HttpGet("idProgram")]
        public async Task<ActionResult<List<object>>> IdWorkprogram(int idProgram)
        {
            try
            {
                var oi = await _linkService.GetxIdworkprogram(idProgram);
                if (oi == null || !oi.Any())
                {
                    _logger.LogWarning("No Link found or the result is empty");
                    return NotFound(new { Message = "No data found", Link = new List<object>() });
                }
                if (oi.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more Link have null Active field");
                }
                return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Links");
                return StatusCode(500, "An error occurred while retrieving Links.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Link lo)
        {
            try
            {
                await _linkService.Save(lo);
                return Ok(new { Message = "Record New with Id", id = lo.Id, Link = lo });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Link");
                return StatusCode(500, "An error occurred while creating Link");
            }
        }

        

        // Controller method
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Link lo)
        {

            try
            {
                var result = await _linkService.Update(id, lo);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Link with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Link.");
            }
        }


        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _linkService.Delete(id);
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
                _logger.LogError(ex, "Error updating Link with ID ", id);
                return StatusCode(500, "An error occurred while updating Link");
            }
        }

    }
}
