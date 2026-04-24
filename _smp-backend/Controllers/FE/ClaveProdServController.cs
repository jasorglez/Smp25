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
    public class ClaveProdServController : ControllerBase
    {
        private readonly IClaveProdServService _claveProdServService;
        private readonly ILogger<ClaveProdServController> _logger;

        public ClaveProdServController(IClaveProdServService claveProdServService, ILogger<ClaveProdServController> logger)
        {
            _claveProdServService = claveProdServService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetClaveProdServ()
        {
            try
            {
                var claveProdServ = await _claveProdServService.GetClaveProdServ();

                if (claveProdServ == null || claveProdServ.Count == 0)
                {
                    _logger.LogWarning("No ClaveProdServ found or the result is empty");
                    return NotFound(new { Message = "No ClaveProdServ found or the result is empty", ClaveProdServ = new List<object>() });
                }
                return Ok(claveProdServ);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveProdServ");
                return StatusCode(500, "An error occurred while retrieving ClaveProdServ.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var claveProdServ = await _claveProdServService.Get2fields();

                if (claveProdServ == null || claveProdServ.Count == 0)
                {
                    _logger.LogWarning("No ClaveProdServ found or the result is empty");
                    return NotFound(new { Message = "No ClaveProdServ found or the result is empty", ClaveProdServ = new List<object>() });
                }
                return Ok(claveProdServ);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveProdServ fields");
                return StatusCode(500, "An error occurred while retrieving ClaveProdServ.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetClaveProdServById(int id)
        {
            var claveProdServ = await _claveProdServService.GetClaveProdServById(id);
            return Ok(claveProdServ);
        }

        [HttpPost]
        public async Task<IActionResult> CreateClaveProdServ([FromBody] ClaveProdServ claveProdServ)
        {
            var createdClaveProdServ = await _claveProdServService.CreateClaveProdServ(claveProdServ);
            return Ok(createdClaveProdServ);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ClaveProdServ claveProdServ)
        {
            if (id != claveProdServ.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedClaveProdServ = await _claveProdServService.Update(id, claveProdServ);
                if (updatedClaveProdServ == null)
                {
                    return NotFound();
                }
                return Ok(updatedClaveProdServ);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ClaveProdServ with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the ClaveProdServ.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _claveProdServService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}