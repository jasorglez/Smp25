﻿
// CustomerCreditsController.cs
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CustomerCreditsController : ControllerBase
{
    private readonly ICustomerCreditService _customerCreditService;
    private readonly ILogger<CustomerCreditsController> _logger;

    public CustomerCreditsController(ICustomerCreditService customerCreditService, ILogger<CustomerCreditsController> logger)
    {
        _customerCreditService = customerCreditService;
        _logger = logger;
    }

    [HttpGet("customer/{customerId}")]
    public async Task<ActionResult<List<object>>> GetByCustomer(int customerId)
    {
        try
        {
            var result = await _customerCreditService.GetByCustomer(customerId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer credits for customer {CustomerId}", customerId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] Creditxcustomer customerCredit)
    {
        try
        {
            var result = await _customerCreditService.Save(customerCredit);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating customer credit");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Creditxcustomer>> Update(int id, [FromBody] Creditxcustomer customerCredit)
    {
        try
        {
            var updatedCredit = await _customerCreditService.Update(id, customerCredit);
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
            var result = await _customerCreditService.Delete(id);
            return Ok();
        }
        catch (LoanDeletionException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting note {Id}", id); // Corrected log message
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}