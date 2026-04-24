using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EmployeesxLoansController : ControllerBase
{
    private readonly IEmployeesxLoansService _employeesxLoansService;
    private readonly ILogger<EmployeesxLoansController> _logger;

    public EmployeesxLoansController(IEmployeesxLoansService employeesxLoansService, ILogger<EmployeesxLoansController> logger)
    {
        _employeesxLoansService = employeesxLoansService;
        _logger = logger;
    }

    [HttpGet("employee/{idEmployee}")]
    public async Task<ActionResult<List<object>>> GetByEmployee(int idEmployee)
    {
        try
        {
            var result = await _employeesxLoansService.LoansByEmployee(idEmployee);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees for branch {idEmployee}", idEmployee);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] EmployeesxLoans employeesxLoans)
    {
        try
        {
            await _employeesxLoansService.Save(employeesxLoans);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating employee");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<EmployeesxLoans>> Update(int id, [FromBody] EmployeesxLoans employeesxLoans)
    {
        try
        {
            var updatedEmployee = await _employeesxLoansService.Update(id, employeesxLoans);
            if (updatedEmployee == null)
            {
                return NotFound();
            }
            return Ok(updatedEmployee);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating employee x loan {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _employeesxLoansService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting employee x loan {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}