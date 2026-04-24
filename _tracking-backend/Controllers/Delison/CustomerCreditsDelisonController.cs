﻿
// CustomerCreditsController.cs
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services.Delison;
using MicroServicioTracking.Services;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;
using MicroServicioTracking.Models.DTOs;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CustomerCreditsDelisonController : ControllerBase
{
    private readonly ICustomerCreditDelisonService _customerCreditDelisonService;
    private readonly ILogger<CustomerCreditsDelisonController> _logger;

    public CustomerCreditsDelisonController(ICustomerCreditDelisonService customerCreditDelisonService, ILogger<CustomerCreditsDelisonController> logger)
    {
        _customerCreditDelisonService = customerCreditDelisonService;
        _logger = logger;
    }

    

    [HttpGet("customer/{customerId}")]
    public async Task<ActionResult<List<object>>> GetByCustomer(int customerId)
    {
        try
        {
            var result = await _customerCreditDelisonService.GetByCustomer(customerId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer credits for customer {CustomerId}", customerId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreditxCustomerDelisonDto customerCreditDto)
    {
        try
        {
            var newCredit = new Creditxcustomer
            {
                IdCustomer = customerCreditDto.CustomerId,
                IdProveedorXTablas = customerCreditDto.ProveedorXTablasId,
                Date = customerCreditDto.Date,
                Total = customerCreditDto.Total,
                Account = 0, // Assuming new credits start with 0 account
                Type = customerCreditDto.Type, // Or determine this from the request if needed
                Active = true,
                Comments = customerCreditDto.Comments
            };

            var result = await _customerCreditDelisonService.Save(newCredit);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating customer credit for customer {CustomerId}", customerCreditDto.CustomerId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    [HttpGet("customer/{proveedroId}/{tablaId}")]
    public async Task<ActionResult<List<object>>> GetByTablaXProveedor(int proveedroId, int tablaId)
    {
        try
        {
            var result = await _customerCreditDelisonService.GetByTablaXProveedor(proveedroId, tablaId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer credits for customer {proveedroId}", proveedroId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("abonoCuentas/{id}")]
    public async Task<ActionResult<object>> UpdateAbono(int id)
    {
        try
        {
            var updatedCredit = await _customerCreditDelisonService.UpdateAbono(id);
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

    [HttpPut("{id}")]
    public async Task<ActionResult<Creditxcustomer>> Update(int id, [FromBody] CreditxCustomerDelisonDto customerCreditDto)
    {
        try
        {
            var updatedCredit = await _customerCreditDelisonService.Update(id, customerCreditDto);
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
            var result = await _customerCreditDelisonService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (LoanDeletionException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting credit {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}