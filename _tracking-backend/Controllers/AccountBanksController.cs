
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class AccountBanksController : ControllerBase
    {
        private readonly IAccountBankService _accountBankService;
        private readonly ILogger<AccountBanksController> _logger;

        public AccountBanksController(IAccountBankService accountBankService, ILogger<AccountBanksController> logger)
        {
            _accountBankService = accountBankService ?? throw new ArgumentNullException(nameof(accountBankService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("Bussines/{id}")]
        public async Task<IActionResult> getAccount(int id)
        {
            try
            {
                var result = await _accountBankService.Accounts(id);
                if (result == null || !result.Any())
                {
                    _logger.LogWarning("No AccountBanks found for Business ID {Id}", id);
                    return NotFound(new { Message = $"No AccountBanks found for Business ID {id}" });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AccountBanks for Business ID {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while retrieving AccountBanks." });
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> getAccountBanks(int id)
        {
            try
            {
                var result = await _accountBankService.Accountsxbanks(id);
                if (result == null || !result.Any())
                {
                    _logger.LogWarning("No AccountBanks found for Business ID {Id}", id);
                    return NotFound(new { Message = $"No AccountBanks found for Business ID {id}" });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AccountBanks for Business ID {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while retrieving AccountBanks." });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Save([FromBody] AccountBank accountBank)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _accountBankService.Save(accountBank);
                return CreatedAtAction(nameof(Save), new { id = accountBank.Id }, accountBank);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving AccountBank");
                return StatusCode(500, new { Message = "An error occurred while saving the AccountBank." });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] AccountBank accountBank)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var updatedAccountBank = await _accountBankService.Update(id, accountBank);
                if (updatedAccountBank == null)
                {
                    _logger.LogWarning("Attempted to update non-existent AccountBank with ID {Id}", id);
                    return NotFound(new { Message = $"AccountBank with ID {id} not found." });
                }

                return Ok(updatedAccountBank);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating AccountBank with ID {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while updating the AccountBank." });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var result = await _accountBankService.Delete(id);
                if (!result)
                {
                    _logger.LogWarning("Attempted to delete non-existent AccountBank with ID {Id}", id);
                    return NotFound(new { Message = $"AccountBank with ID {id} not found." });
                }

                return Ok(new { Message = "AccountBank successfully deactivated." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting AccountBank with ID {Id}", id);
                return StatusCode(500, new { Message = "An error occurred while deleting the AccountBank." });
            }
        }
    }
}
