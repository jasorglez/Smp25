using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class EmployeesxCheckInsOutsController: ControllerBase
{
    private readonly IEmployeesXCheckInsOutsService _employeesXCheckInsOutsService;
    private readonly ILogger<EmployeesxCheckInsOutsService> _logger;

    public EmployeesxCheckInsOutsController(IEmployeesXCheckInsOutsService employeesXCheckInsOutsService,
        ILogger<EmployeesxCheckInsOutsService> logger)
    {
        _employeesXCheckInsOutsService = employeesXCheckInsOutsService;
        _logger = logger;
    }
    
    [HttpGet]
    public async Task<ActionResult<List<object>>> AllChecks(int idBranch)
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.AllChecks(idBranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clock for branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("employee/{idEmployee}")]
    public async Task<ActionResult<List<object>>> ChecksByEmployee(int idEmployee, DateTime start, DateTime end)
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.ChecksByEmployee(idEmployee, start, end);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving clock for employee {IdEmployee} on certain range", idEmployee);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("branch/{idBranch}")]
    public async Task<ActionResult<List<object>>> ChecksByBranch(int idBranch, DateTime start, DateTime end)
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.ChecksByBranch(idBranch, start, end);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving checks by range from {Start} to {End} for Branch ID {IdBranch}", start, end, idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("employee/{idEmployee}/incidents")]
    public async Task<ActionResult<Dictionary<string, object>>> IncidentsByEmployee(int idEmployee, DateTime start, DateTime end)
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.IncidentsByEmployee(idEmployee, start, end);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incidents for employee {IdEmployee}", idEmployee);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("branch/{idBranch}/incidents")]
    public async Task<ActionResult<List<object>>> IncidentsByCompany(
        int idBranch
        )
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.IncidentsByCompany(idBranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incidents for branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] EmployeesxCheckInsOuts employeesxCheckInsOuts)
    {
        try
        {
            await _employeesXCheckInsOutsService.Save(employeesxCheckInsOuts);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating clock");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPut("{id}")]
    public async Task<ActionResult<EmployeesxCheckInsOuts>> Update(int id, [FromBody] EmployeesxCheckInsOuts employeesxCheckInsOuts)
    {
        try
        {
            var updatedCheck = await _employeesXCheckInsOutsService.Update(id, employeesxCheckInsOuts);
            if (updatedCheck == null)
            {
                return NotFound();
            }
            return Ok(updatedCheck);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating check {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("branch/{idBranch}/discrepances")]
    public async Task<ActionResult<List<object>>> DiscrepancesByBranch(
        int idBranch)
    {
        try
        {
            var result = await _employeesXCheckInsOutsService.Discrepances(idBranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving incidents for branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPatch("{id}/discrepance")]
    public async Task<ActionResult<EmployeesxCheckInsOuts>> UpdateDiscrepance(int id, [FromBody] UpdateDiscrepanceDTO updateDto)
    {
        try
        {
            var updatedCheck = await _employeesXCheckInsOutsService.UpdateDiscrepance(id, updateDto);
            if (updatedCheck == null)
            {
                return NotFound();
            }
            return Ok(updatedCheck);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error actualizando discrepancia para el registro {Id}", id);
            return StatusCode(500, "Ocurrió un error al procesar la solicitud.");
        }
    }
}