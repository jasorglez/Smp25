using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Services;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EmployeesXClockController: ControllerBase
{
    private readonly IEmployeesXClockService _employeesXClockService;
    private readonly ILogger<EmployeesXClockService> _logger;
    
    public EmployeesXClockController(IEmployeesXClockService employeesXClockService, ILogger<EmployeesXClockService> logger)
    {
        _employeesXClockService = employeesXClockService;
        _logger = logger;
    }
    
    [HttpGet("employee/{idEmployee}")]
    public async Task<ActionResult<List<object>>> ClockByEmployee(int idEmployee)
    {
        try
        {
            var result = await _employeesXClockService.ClockByEmployee(idEmployee);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clock for employee {IdEmployee}", idEmployee);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("branch/{idBranch}/{day}")]
    public async Task<ActionResult<List<object>>> ClockByEmployeeByBranch(int idBranch, string day)
    {
        try
        {
            var result = await _employeesXClockService.ClockByEmployeeByBranch(idBranch, day);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clock for employee");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("employee/{idEmployee}/{day}")]
    public async Task<ActionResult<List<object>>> ClockByEmployeeAndDay(int idEmployee, string day)
    {
        try
        {
            var result = await _employeesXClockService.ClockByEmployeeAndDay(idEmployee, day);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clock for employee {IdEmployee}", idEmployee);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] EmployeesXClock employeesXClock)
    {
        try
        {
            await _employeesXClockService.Save(employeesXClock);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating clock");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPut("{idEmployee}/{day}")]
    public async Task<ActionResult> Update(int idEmployee, string day, [FromBody] EmployeesXClock employeesXClock)
    {
        try
        {
            await _employeesXClockService.Update(idEmployee,day, employeesXClock);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating clock");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("employee/{employeeId}/total-hours")]
    public async Task<ActionResult<decimal>> GetEmployeeTotalHoursByDateRange(
        int employeeId, 
        [FromQuery] DateTime startDate, 
        [FromQuery] DateTime endDate)
    {
        try
        {
            var totalHours = await _employeesXClockService.GetEmployeeTotalHoursByDateRange(startDate, endDate, employeeId);
            return Ok(totalHours);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving total hours for employee {EmployeeId} between {StartDate} and {EndDate}", 
                employeeId, startDate, endDate);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}