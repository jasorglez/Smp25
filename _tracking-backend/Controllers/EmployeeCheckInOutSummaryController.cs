using MicroServicioTracking.Models.View;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EmployeeCheckInOutSummaryController: ControllerBase
{
    private readonly IEmployeeCheckInOutSummaryService _employeeCheckInOutSummaryService;
    private readonly ILogger<EmployeeCheckInOutSummaryController> _logger;
    
    public EmployeeCheckInOutSummaryController(IEmployeeCheckInOutSummaryService employeeCheckInOutSummaryService, ILogger<EmployeeCheckInOutSummaryController> logger)
    {
        _employeeCheckInOutSummaryService = employeeCheckInOutSummaryService;
        _logger = logger;
    }
    
    [HttpGet]
    public async Task<ActionResult<List<EmployeeCheckInOutSummaryView>>> GetEmployeeCheckInOutSummary(
        [FromQuery] int idEmployee, 
        [FromQuery] DateTime startDate, 
        [FromQuery] DateTime endDate)
    {
        try
        {
            var result = await _employeeCheckInOutSummaryService.GetEmployeeCheckInOutSummary(
                idEmployee, startDate, endDate);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener el resumen para el empleado {idEmployee}", idEmployee);
            return StatusCode(500, "Ocurrió un error al procesar la solicitud.");
        }
    }
}