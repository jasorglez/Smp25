using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;


namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ConceptsxLoansCreditsController : ControllerBase
    {
        private readonly IConceptsxLoansCreditsService _service;
        private readonly ILogger<ConceptsxLoansCreditsController> _logger;

        public ConceptsxLoansCreditsController(IConceptsxLoansCreditsService service, ILogger<ConceptsxLoansCreditsController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("loanandcredit/{idLoanAndCredit}")]
        public async Task<ActionResult<List<ConceptsxLoansCredit>>> GetByLoanAndCreditId(int idLoanAndCredit)
        {
            try
            {
                var concepts = await _service.GetByLoanAndCreditId(idLoanAndCredit);
                return Ok(concepts);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting concepts by LoanAndCredit ID: {idLoanAndCredit}", idLoanAndCredit);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] ConceptsxLoansCredit concept)
        {
            try
            {
                await _service.Save(concept);
                return Ok();
            }
            catch (ConceptsxLoansCreditService.InvalidConceptPaymentException ex)
            {
                // Devuelve 400 con el mensaje personalizado
                return BadRequest(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating concept", concept);
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<ConceptsxLoansCredit>> Update(int id, [FromBody] ConceptsxLoansCredit concept)
        {
            try
            {
                var updatedConcept = await _service.Update(id, concept);
                if (updatedConcept == null)
                {
                    return NotFound();
                }
                return Ok(updatedConcept);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating concept {id}", id, concept);
                return StatusCode(500, "Internal server error");
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
                    return NotFound();
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting concept {id}", id);
                return StatusCode(500, "Internal server error");
            }
        }
    }
}