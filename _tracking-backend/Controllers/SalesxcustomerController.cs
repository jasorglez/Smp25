using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class SalesxcustomerController : ControllerBase
    {
        private readonly ISalesxcustomerService _salesxcustomerService;
        private readonly ILogger<SalesxcustomerController> _logger;

        public SalesxcustomerController(ISalesxcustomerService salesxcustomerService, ILogger<SalesxcustomerController> logger)
        {
            _salesxcustomerService = salesxcustomerService;
            _logger = logger;
        }

        [HttpGet("byCustomer/{customerId}")]
        public async Task<ActionResult<IEnumerable<object>>> GetByCustomerId(int customerId)
        {
            try
            {
                var sales = await _salesxcustomerService.GetByCustomerId(customerId);
                return Ok(sales);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while retrieving sales for customer id: {CustomerId}", customerId);
                return StatusCode(500, "Internal server error while retrieving sales");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Salesxcustomer>> GetById(int id)
        {
            try
            {
                var sale = await _salesxcustomerService.GetById(id);
                if (sale == null)
                {
                    return NotFound($"Sale with ID {id} not found");
                }
                return Ok(sale);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while retrieving sale with id: {Id}", id);
                return StatusCode(500, "Internal server error while retrieving sale");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Salesxcustomer>> Create(Salesxcustomer sale)
        {
            try
            {
                await _salesxcustomerService.Save(sale);
                return CreatedAtAction(nameof(GetById), new { id = sale.Id }, sale);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while creating sale");
                return StatusCode(500, "Internal server error while creating sale");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<Salesxcustomer>> Update(int id, Salesxcustomer sale)
        {
            try
            {
                var updatedSale = await _salesxcustomerService.Update(id, sale);
                if (updatedSale == null)
                {
                    return NotFound($"Sale with ID {id} not found");
                }
                return Ok(updatedSale);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while updating sale with id: {Id}", id);
                return StatusCode(500, "Internal server error while updating sale");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var result = await _salesxcustomerService.Delete(id);
                if (!result)
                {
                    return NotFound($"Sale with ID {id} not found");
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error while deleting sale with id: {Id}", id);
                return StatusCode(500, "Internal server error while deleting sale");
            }
        }
    }
}