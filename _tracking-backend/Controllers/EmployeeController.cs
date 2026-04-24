
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EmployeeController : ControllerBase
{
    private readonly IEmployeeService _employeeService;
    private readonly ILogger<EmployeeController> _logger;

    public EmployeeController(IEmployeeService employeeService, ILogger<EmployeeController> logger)
    {
        _employeeService = employeeService;
        _logger = logger;
    }

    [HttpGet("branch/{branchId}")]
    public async Task<ActionResult<List<object>>> GetByBranch(int branchId)
    {
        try
        {
            var result = await _employeeService.EmployeesByBranch(branchId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    [HttpGet("branchClinica/{branchId}")]
    public async Task<ActionResult<List<object>>> GetByBranch(int branchId, string Type)
    {
        try
        {
            var result = await _employeeService.EmployeesByBranchClinica(branchId, Type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }  
 
    [HttpGet("name/{name}")]
    public async Task<ActionResult<List<object>>> GetByName(string name)
    {
        try
        {
            var result = await _employeeService.findEmployees(name);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Employees for Name {name}", name);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }


    [HttpGet("branchVigente/{branchId}")]
    public async Task<ActionResult<List<object>>> GetByBranchVigente(int branchId)
    {
        try
        {
            var result = await _employeeService.EmployeesByBranchVigente(branchId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<List<object>>> GetById(int id)
    {
        try
        {
            var result = await _employeeService.Employee(id);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees for ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("clock")]
    public async Task<ActionResult<List<object>>> GetInfoForClock(string employeeCode, string clockPassword)
    {
        try
        {
            var result = await _employeeService.IdUserAndPassword(employeeCode, clockPassword);
            if (result == null || !result.Any())
            {
                return NotFound("No employee found with the provided credentials.");
            }
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving employees provided credentials");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] Employee employee)
    {
        try
        {
            if (!string.IsNullOrEmpty(employee.Name))
            {
                employee.Name = employee.Name.ToUpper();
            }
            if (!string.IsNullOrEmpty(employee.Address))
            {
                employee.Address = employee.Address.ToUpper();
            }
            await _employeeService.Save(employee);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating employee");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Employee>> Update(int id, [FromBody] Employee employee)
    {
        try
        {
            var updatedEmployee = await _employeeService.Update(id, employee);
            if (updatedEmployee == null)
            {
                return NotFound();
            }
            return Ok(updatedEmployee);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating employee {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _employeeService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting employee {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}
