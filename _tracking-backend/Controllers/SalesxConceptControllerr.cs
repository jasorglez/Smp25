
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SalesxconceptController : ControllerBase
    {
        private readonly ISalesxconceptService _salesxconceptService;
        private readonly ILogger<SalesxconceptController> _logger;

        public SalesxconceptController(ISalesxconceptService salesxconceptService, ILogger<SalesxconceptController> logger)
        {
            _salesxconceptService = salesxconceptService;
            _logger = logger;
        }

        [HttpGet("bySale/{saleId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetBySaleId(int saleId)
        {
            try
            {
                var concepts = await _salesxconceptService.GetBySaleId(saleId);
                return Ok(concepts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while retrieving sales concepts for sale id: {SaleId}", saleId);
                return StatusCode(500, "Internal server error while retrieving sales concepts");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Salesxconcept>> GetById(int id)
        {
            try
            {
                var concept = await _salesxconceptService.GetById(id);
                if (concept == null)
                {
                    return NotFound($"Sales concept with ID {id} not found");
                }
                return Ok(concept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while retrieving sales concept with id: {Id}", id);
                return StatusCode(500, "Internal server error while retrieving sales concept");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Salesxconcept>> Create(Salesxconcept concept)
        {
            try
            {
                await _salesxconceptService.Save(concept);
                return CreatedAtAction(nameof(GetById), new { id = concept.Id }, concept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while creating sales concept");
                return StatusCode(500, "Internal server error while creating sales concept");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Salesxconcept>> Update(int id, Salesxconcept concept)
        {
            try
            {
                var updatedConcept = await _salesxconceptService.Update(id, concept);
                if (updatedConcept == null)
                {
                    return NotFound($"Sales concept with ID {id} not found");
                }
                return Ok(updatedConcept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while updating sales concept with id: {Id}", id);
                return StatusCode(500, "Internal server error while updating sales concept");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _salesxconceptService.Delete(id);
                if (!result)
                {
                    return NotFound($"Sales concept with ID {id} not found");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting sales concept with id: {Id}", id);
                return StatusCode(500, "Internal server error while deleting sales concept");
            }
        }
    }
}