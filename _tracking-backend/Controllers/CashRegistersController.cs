using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CashRegistersController : ControllerBase
{
    private readonly ICashRegistersService _cashRegistersService;
    private readonly ILogger<CashRegistersController> _logger;
    
    public CashRegistersController(ICashRegistersService cashRegistersService, ILogger<CashRegistersController> logger)
    {
        _cashRegistersService = cashRegistersService;
        _logger = logger;
    }

    [HttpGet("all")]
    public async Task<ActionResult<List<object>>> GetByAll()
    {
        try
        {
            var result = await _cashRegistersService.GetByCashAll();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cash registers for store");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    [HttpGet("branch/{idbranch}")]
    public async Task<ActionResult<List<object>>> GetBybranch(int idbranch)
    {
        try
        {
            var result = await _cashRegistersService.GetCashByBranch(idbranch);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cash registers for store {idbranch}", idbranch);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("company/{idCompany}")]
    public async Task<ActionResult<List<object>>> GetByCompany(int idCompany)
    {
        try
        {
            var result = await _cashRegistersService.GetCashByCompany(idCompany);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cash registers for store {idCompany}", idCompany);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("store/{storeId}")]
    public async Task<ActionResult<List<object>>> GetByStore(int storeId)
    {
        try
        {
            var result = await _cashRegistersService.GetByStore(storeId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cash registers for store {StoreId}", storeId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<CashRegisters>> GetById(int id)
    {
        try
        {
            var cashRegister = await _cashRegistersService.GetById(id);
            if (cashRegister == null)
            {
                return NotFound();
            }
            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving cash register with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CashRegisters cashRegister)
    {
        try
        {
            await _cashRegistersService.Save(cashRegister);
            return Ok(cashRegister);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving cash register");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] CashRegisters cashRegister)
    {
        try
        {
            await _cashRegistersService.Save(cashRegister);
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating cash register");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var cashRegister = await _cashRegistersService.Delete(id);
            if (cashRegister == null)
            {
                return NotFound();
            }

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting cash register with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}