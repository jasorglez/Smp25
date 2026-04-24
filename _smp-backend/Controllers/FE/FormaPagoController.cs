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
    public class FormaPagoController : ControllerBase
    {
        private readonly IFormaPagoService _formaPagoService;
        private readonly ILogger<FormaPagoController> _logger;

        public FormaPagoController(IFormaPagoService formaPagoService, ILogger<FormaPagoController> logger)
        {
            _formaPagoService = formaPagoService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetFormaPago()
        {
            try
            {
                var formaPago = await _formaPagoService.GetFormaPago();

                if (formaPago == null || formaPago.Count == 0)
                {
                    _logger.LogWarning("No FormaPago found or the result is empty");
                    return NotFound(new { Message = "No FormaPago found or the result is empty", FormaPago = new List<object>() });
                }
                return Ok(formaPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving FormaPago");
                return StatusCode(500, "An error occurred while retrieving FormaPago.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> Get2fields()
        {
            try
            {
                var formaPago = await _formaPagoService.Get2fields();

                if (formaPago == null || formaPago.Count == 0)
                {
                    _logger.LogWarning("No FormaPago found or the result is empty");
                    return NotFound(new { Message = "No FormaPago found or the result is empty", FormaPago = new List<object>() });
                }
                return Ok(formaPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving FormaPago fields");
                return StatusCode(500, "An error occurred while retrieving FormaPago.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetFormaPagoById(int id)
        {
            var formaPago = await _formaPagoService.GetFormaPagoById(id);
            return Ok(formaPago);
        }

        [HttpPost]
        public async Task<IActionResult> CreateFormaPago([FromBody] FormaPago formaPago)
        {
            var createdFormaPago = await _formaPagoService.CreateFormaPago(formaPago);
            return Ok(createdFormaPago);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] FormaPago formaPago)
        {
            if (id != formaPago.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedFormaPago = await _formaPagoService.Update(id, formaPago);
                if (updatedFormaPago == null)
                {
                    return NotFound();
                }
                return Ok(updatedFormaPago);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating FormaPago with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the FormaPago.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var result = await _formaPagoService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return NoContent();
        }
    }
}