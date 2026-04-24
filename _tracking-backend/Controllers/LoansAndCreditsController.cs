
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic; // Important: Add this using statement

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LoansAndCreditsController : ControllerBase // Corrected controller name
{
    private readonly ILoansAndCreditsService _loansAndCreditsService; // Corrected service type
    private readonly ILogger<LoansAndCreditsController> _logger; // Corrected logger type

    public LoansAndCreditsController(ILoansAndCreditsService loansAndCreditsService, ILogger<LoansAndCreditsController> logger)
    {
        _loansAndCreditsService = loansAndCreditsService ?? throw new ArgumentNullException(nameof(loansAndCreditsService));;
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));;
    }

    [HttpGet("employee/{idEmployee}")]
    public async Task<ActionResult<List<Loanandcredit>>> GetByEmployee(int idEmployee, string Type) // Corrected return type
    {
        try
        {
            var result = await _loansAndCreditsService.LoansByEmployee(idEmployee, Type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving loans for employee {idEmployee}", idEmployee); // Corrected log message
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult> Create([FromBody] Loanandcredit loanandcredit)
    {
        try
        {
            var savedLoanandcredit = await _loansAndCreditsService.Save(loanandcredit);
            return Ok(savedLoanandcredit);
        }
        catch (InsufficientFundsException ex)
        {
            _logger.LogError(ex, "Error creating loan");
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating loan");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Loanandcredit>> Update(int id, [FromBody] Loanandcredit loanandcredit) // Corrected model and return type
    {
        try
        {
            var updatedLoan = await _loansAndCreditsService.Update(id, loanandcredit);
            if (updatedLoan == null)
            {
                return NotFound();
            }
            return Ok(updatedLoan);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating loan {Id}", id); // Corrected log message
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _loansAndCreditsService.Delete(id);
            return Ok();
        }
        catch (LoanDeletionException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting loan {Id}", id); // Corrected log message
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("loans")]
    public async Task<ActionResult<List<object>>> GetLoansWithEmployeeNames(int idBranch)
    {
        try
        {
            var result = await _loansAndCreditsService.GetLoansWithEmployeeNames(idBranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving loans with employee names on branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("savings")]
    public async Task<ActionResult<List<object>>> GetSavingsWithEmployeeNames(int idBranch)
    {
        try
        {
            var result = await _loansAndCreditsService.GetSavingsWithEmployeeNames(idBranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving loans with employee names on branch {IdBranch}", idBranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}