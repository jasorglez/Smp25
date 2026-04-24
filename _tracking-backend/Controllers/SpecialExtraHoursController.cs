using MicroServicioTracking.Services;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SpecialExtraHoursController: ControllerBase
{
    private readonly ISpecialExtraHoursService _specialExtraHoursService;
    private readonly ILogger<SpecialExtraHoursController> _logger;

    public SpecialExtraHoursController(ISpecialExtraHoursService specialExtraHoursService,
        ILogger<SpecialExtraHoursController> logger)
    {
        _specialExtraHoursService = specialExtraHoursService ?? throw new ArgumentNullException(nameof(specialExtraHoursService));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    [HttpGet("employee/{idEmployee}")]
    public async Task<ActionResult<List<SpecialExtraHours>>> GetSpecialExtraHours(int idEmployee, DateTime startDate, DateTime endDate)
    {
        try
        {
            var result = await _specialExtraHoursService.GetSpecialExtraHours(idEmployee, startDate, endDate);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving special extra hours for employee {IdEmployee} between dates {StartDate} and {EndDate}", 
                idEmployee, startDate, endDate);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult<SpecialExtraHours>> Save([FromBody] SpecialExtraHours specialExtraHours)
    {
        try
        {
            var result = await _specialExtraHoursService.Save(specialExtraHours);
            return CreatedAtAction(nameof(GetSpecialExtraHours), new { idEmployee = specialExtraHours.IdEmployee }, result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving special extra hours");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPut]
    public async Task<ActionResult<SpecialExtraHours>> Update(int id, [FromBody] SpecialExtraHours specialExtraHours)
    {
        try
        {
            var result = await _specialExtraHoursService.Update(id, specialExtraHours);
            return Ok(result);
        }
        catch (KeyNotFoundException knfEx)
        {
            _logger.LogError(knfEx, "SpecialExtraHours with ID {Id} not found", id);
            return NotFound(knfEx.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating special extra hours with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var result = await _specialExtraHoursService.Delete(id);
            if (result == null)
            {
                return NotFound();
            }

            return NoContent();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting special extra hours with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}