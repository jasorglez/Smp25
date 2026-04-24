using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class BankController : ControllerBase
    {
        private readonly IBankService _service;
        private readonly ILogger<BankController> _logger;

        public BankController(IBankService service, ILogger<BankController> logger)
        {
            _service = service ?? throw new ArgumentNullException(nameof(service));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<Bank>>> GetAll()
        {
            try
            {
                var banks = await _service.GetAll();
                if (banks == null || banks.Count == 0)
                {
                    _logger.LogWarning("No banks found");
                    return NotFound(new { Message = "No data found", Banks = new List<Bank>() });
                }
                return Ok(banks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving banks");
                return StatusCode(500, "An error occurred while retrieving the banks");
            }
        }

        [HttpGet("2fields")]
        public async Task<ActionResult<List<Bank>>> Get2fields()
        {
            try
            {
                var banks = await _service.Get2fields();
                if (banks == null || banks.Count == 0)
                {
                    _logger.LogWarning("No banks found");
                    return NotFound(new { Message = "No data found", Banks = new List<Bank>() });
                }
                return Ok(banks);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving banks");
                return StatusCode(500, "An error occurred while retrieving the banks");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Bank>> GetById(int id)
        {
            try
            {
                var bank = await _service.GetById(id);
                if (bank == null)
                {
                    return NotFound($"Bank with ID {id} not found");
                }
                return Ok(bank);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving bank with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the bank");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] Bank bank)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _service.Save(bank);
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving bank");
                return StatusCode(500, "An error occurred while saving the bank");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Bank>> Update(int id, [FromBody] Bank bank)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedBank = await _service.Update(id, bank);
                if (updatedBank == null)
                {
                    return NotFound($"Bank with ID {id} not found");
                }
                return Ok(updatedBank);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating bank with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the bank");
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
                    return NotFound($"Bank with ID {id} not found");
                }
                return Ok();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the bank");
            }
        }
    }
}
