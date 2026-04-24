using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class PaymentsCreditsxCustomersController : ControllerBase
{
    private readonly IPaymentsCreditsxCustomersService _paymentsCreditsxCustomersService;
    private readonly ILogger<PaymentsCreditsxCustomersController> _logger;

    public PaymentsCreditsxCustomersController(IPaymentsCreditsxCustomersService paymentsCreditsxCustomersService, ILogger<PaymentsCreditsxCustomersController> logger)
    {
        _paymentsCreditsxCustomersService = paymentsCreditsxCustomersService;
        _logger = logger;
    }
    
    [HttpGet("credit/{id_credit}")]
    public async Task<ActionResult<List<object>>> GetByCredit(int id_credit)
    {
        try
        {
            var result = await _paymentsCreditsxCustomersService.GetByCredit(id_credit);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer data by payment {IdCredit}", id_credit);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] PaymentsCreditsxCustomers paymentsCreditsxCustomers)
    {
        try
        {
            await _paymentsCreditsxCustomersService.Save(paymentsCreditsxCustomers);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating customer credit");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PaymentsCreditsxCustomers>> Update(int id, [FromBody] PaymentsCreditsxCustomers paymentsCreditsxCustomers)
    {
        try
        {
            var updatedCredit = await _paymentsCreditsxCustomersService.Update(id, paymentsCreditsxCustomers);
            if (updatedCredit == null)
            {
                return NotFound();
            }
            return Ok(updatedCredit);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer credit {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _paymentsCreditsxCustomersService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting customer credit {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}