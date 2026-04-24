using MicroServicioTracking.Models.Fact;
using MicroServicioTracking.Services.Fact;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;


namespace MicroServicioTracking.Controllers.Fact;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CustomersBillingController : ControllerBase
{
    private readonly ICustomersBillingService _service;
    private readonly ILogger<CustomersBillingController> _logger;

    public CustomersBillingController(
        ICustomersBillingService service,
        ILogger<CustomersBillingController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet("by-root/{idRoot}")]
    public async Task<IActionResult> GetByRoot(int idRoot)
    {
        try
        {
            var customers = await _service.GetByRoot(idRoot);
            return Ok(customers);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customers billing for root {IdRoot}", idRoot);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("by-customer/{idCustomer}")]
    public async Task<IActionResult> GetByCustomer(int idCustomer)
    {
        try
        {
            var customersBilling = await _service.GetByCustomer(idCustomer);
            return Ok(customersBilling);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customers billing for customer {IdCustomer}", idCustomer);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        try
        {
            var customer = await _service.GetById(id);
            if (customer == null)
                return NotFound(new { error = "Customer billing not found" });

            return Ok(customer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting customer billing {Id}", id);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] CustomersBilling customer)
    {
        try
        {
            await _service.Save(customer);
            return Ok(new { success = true, message = "Customer billing saved" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving customer billing");
            return BadRequest(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] CustomersBilling customer)
    {
        try
        {
            var updated = await _service.Update(id, customer);
            if (updated == null)
                return NotFound(new { success = false, error = "Customer billing not found" });

            return Ok(new { success = true, data = updated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer billing");
            return BadRequest(new { success = false, error = ex.Message });
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var deleted = await _service.Delete(id);
            if (!deleted)
                return NotFound(new { success = false, error = "Customer billing not found" });

            return Ok(new { success = true, message = "Customer billing deleted" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting customer billing");
            return BadRequest(new { success = false, error = ex.Message });
        }
    }
}