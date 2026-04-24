using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using System.Diagnostics.Contracts;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class IdentificationController : ControllerBase
    {

        private readonly IidentificationService _identificationService;
        private readonly ILogger<IdentificationController> _logger;

        public IdentificationController(IidentificationService identificationService, ILogger<IdentificationController> logger)
        {
            _identificationService = identificationService;
            _logger = logger;
        }

        [HttpGet()]
        public async Task<ActionResult<List<Identification>>> Get(int idProject)
        {
            try
            {
                var result = await _identificationService.Get(idProject);
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No Identification found or the result is empty");
                    return NotFound(new { Message = "No data found", identifications = new List<object>() });
                }
                return Ok(result);
            }

            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting Identifications for project {IdProject}", idProject);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    

        [HttpPost]
        public async Task<ActionResult<Identification>> Save(Identification identification)
        {
            try
            {
                var result = await _identificationService.Save(identification);
                return CreatedAtAction(nameof(Get), new { idProject = result.IdProject }, result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while saving Identification");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Identification>> Update(int id, Identification identification)
        {
            try
            {
                var result = await _identificationService.Update(id, identification);
                if (result == null)
                {
                    return NotFound();
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Identification with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }


        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {

            try
            {
                var success = await _identificationService.Delete(id);
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
                _logger.LogError(ex, "Error updating Identifications with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Identifications");
            }
        }




    }
}
