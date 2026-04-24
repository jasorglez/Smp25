using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models.TD;
using SMP.Services.TD;

namespace SMP.Controllers.TD
{
    [Authorize]
    [ApiController]
    [Route("api/TDConcepts")]
    public class ConceptsController : ControllerBase
    {
        private readonly ILogger<ConceptsController> _logger;
        private readonly IConceptsService _conceptsService;

        public ConceptsController(IConceptsService conceptsService, ILogger<ConceptsController> logger)
        {
            _conceptsService = conceptsService ?? throw new ArgumentNullException(nameof(conceptsService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Concepts>>> GetAll(int idCompany)
        {
            try
            {
                var concepts = await _conceptsService.GetAllConcepts(idCompany);
                return Ok(concepts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concepts");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Concepts>> GetById(int id)
        {
            try
            {
                var concept = await _conceptsService.GetConceptById(id);
                if (concept == null)
                {
                    return NotFound($"Concept with ID {id} not found");
                }
                return Ok(concept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving concept with ID {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Concepts>> Create([FromBody] Concepts concept)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var createdConcept = await _conceptsService.CreateConcept(concept);
                return CreatedAtAction(nameof(GetById), new { id = createdConcept.Id }, createdConcept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating concept");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Concepts>> Update(int id, [FromBody] Concepts concept)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(ModelState);
                }

                var updatedConcept = await _conceptsService.UpdateConcept(id, concept);
                if (updatedConcept == null)
                {
                    return NotFound($"Concept with ID {id} not found");
                }

                return Ok(updatedConcept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating concept with ID {id}");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _conceptsService.DeleteConcept(id);
                if (!result)
                {
                    return NotFound($"Concept with ID {id} not found");
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting concept with ID {id}");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}