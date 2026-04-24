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

    public class IdentificationriskController : ControllerBase
    {
        private readonly IIdentificationRiskService _service;
        private readonly ILogger<IdentificationriskController> _logger;

        public IdentificationriskController(IIdentificationRiskService service, ILogger<IdentificationriskController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("{idProject}")]
        public async Task<ActionResult<IEnumerable<object>>> GetIdentificationRisks(int idProject, DateTime date)
        {
            try
            {
                var risks = await _service.GetIdentificationRisks(idProject, date);
                if (risks == null || !risks.Any())
                {
                    _logger.LogWarning("No Identificationrisk found or the result is empty");
                    return NotFound(new { Message = "No data found", Identificationrisk = new List<object>() });
                }
                    
                return Ok(risks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while getting identification risks for project {IdProject}", idProject);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> CreateIdentificationRisk([FromBody] Identificationrisk risk)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(risk);
                return CreatedAtAction(nameof(GetIdentificationRisks), new { idProject = risk.IdProject }, risk);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while creating identification risk");
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateIdentificationRisk(int id, [FromBody] Identificationrisk risk)
        {
            if (id != risk.Id)
            {
                return BadRequest("ID mismatch");
            }

            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedRisk = await _service.Update(id, risk);
                if (updatedRisk == null)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating identification risk with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteIdentificationRisk(int id)
        {
            try
            {
                var result = await _service.Delete(id);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting identification risk with ID {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}