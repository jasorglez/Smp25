using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ConceptsxIncorExpController : ControllerBase
    {
        private readonly IConceptsxIncorExpService _service;

        public ConceptsxIncorExpController(IConceptsxIncorExpService service)
        {
            _service = service;
        }

        [HttpGet("incorexp/{id}")]
        public async Task<IActionResult> GetByIncorExpId(int id)
        {
            var concepts = await _service.GetByIncorExpId(id);
            return Ok(concepts);
        }


        [HttpGet("search")]
        public async Task<IActionResult> GetByUuid([FromQuery] string uuid)
        {
            if (string.IsNullOrWhiteSpace(uuid))
                return BadRequest("The uuid parameter is required.");

            var concepts = await _service.GetByUUI(uuid);
            return Ok(concepts);
        }


        [HttpGet("cfdi/{cfdi}")]
        public async Task<IActionResult> GetByCfdi(string cfdi)
        {
            try
            {
                var concepts = await _service.GetByCfdi(cfdi);

                if (concepts == null || !concepts.Any())
                {
                    return NotFound(new
                    {
                        message = $"No se encontraron registros para el CFDI: {cfdi}",
                        cfdi = cfdi
                    });
                }

                return Ok(concepts);
            }
            catch (Exception ex)
            {
                // Log the exception here if you have logging configured
                return StatusCode(500, new
                {
                    message = "Ocurrió un error interno al procesar la solicitud",
                    error = ex.Message
                });
            }
        }


        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var concept = await _service.GetById(id);
            if (concept == null) return NotFound();
            return Ok(concept);
        }

        [HttpGet("incorexp/{id}/all")]
        public async Task<IActionResult> GetAllByIncorExpId(int id)
        {
            var concepts = await _service.GetAllByIncorExpId(id);
            return Ok(concepts);
        }

        [HttpPost]
        public async Task<IActionResult> Save([FromBody] ConceptsxIncorExp concept)
        {
            await _service.Save(concept);
            return CreatedAtAction(nameof(GetById), new { id = concept.Id }, concept);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] ConceptsxIncorExp concept)
        {
            var updatedConcept = await _service.Update(id, concept);
            if (updatedConcept == null) return NotFound();
            return Ok(updatedConcept);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _service.Delete(id);
            if (!result) return NotFound();
            return NoContent();
        }

        [HttpGet("byroot")]
        public async Task<IActionResult> GetDailyByRoot([FromQuery] int idroot)
        {
            if (idroot <= 0)
                return BadRequest("El parámetro idroot es requerido.");

            var result = await _service.GetDailyByRoot(idroot);
            return Ok(result);
        }
    }
}
