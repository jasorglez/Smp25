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
    public class AttachController : ControllerBase
    {
        private readonly IAttachService _attachService;
        private readonly ILogger<AttachController> _logger;

        public AttachController(IAttachService attachService, ILogger<AttachController> logger)
        {
            _attachService = attachService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> Getxid(int idTabla, string typeDocto)
        {
            try
            {
                var at = await _attachService.GetxId(idTabla, typeDocto);

                if (at == null || !at.Any())
                {
                    _logger.LogWarning("No Attach found or the result is empty");
                    return NotFound(new { Message = "No Attach found or the result is empty", Attach = new List<object>() });
                }
                return Ok(at);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Attach for Project");
                return StatusCode(500, "An error occurred while retrieving Attach.");
            }
        }

        [HttpGet("docto")]
        public async Task<IActionResult> GetxTypedocto(string docto)
        {
            try
            {
                var at = await _attachService.GetxTypedocto(docto);

                if (at == null || !at.Any())
                {
                    _logger.LogWarning("No Attach found or the result is empty");
                    return NotFound(new { Message = "No Attach found or the result is empty", Attach = new List<object>() });
                }
                return Ok(at);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Attach for Project");
                return StatusCode(500, "An error occurred while retrieving Attach.");
            }
        }


        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Attach at)
        {
            try
            {
                await _attachService.Save(at);
                return Ok(new { Message = "Record New with Id", id = at.Id, Attach = at });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Attach");
                return StatusCode(500, "An error occurred while creating the Attach");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Attach at)
        {
            if (id != at.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedAt = await _attachService.Update(id, at);
                if (updatedAt == null)
                {
                    return NotFound();
                }
                return Ok(updatedAt);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Attach with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Attach.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]

        public async Task<IActionResult> Delete(int id)
        {

            try
            {
                var success = await _attachService.Delete(id);
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
                _logger.LogError(ex, "Error updating Attach with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Attach");
            }
        }
    }
}
