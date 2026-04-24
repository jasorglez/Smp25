using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class StoresController : ControllerBase
{
    private readonly IStoresService _storesService;
    private readonly ILogger<StoresController> _logger;
    
    public StoresController(IStoresService storesService, ILogger<StoresController> logger)
    {
        _storesService = storesService;
        _logger = logger;
    }

    [HttpGet("all")]
    public async Task<ActionResult<List<object>>> GetAll()
    {
        try
        {
            var result = await _storesService.GetBranchAllCompany();
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stores for All");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("company/{idCompany}")]
    public async Task<ActionResult<List<object>>> GetBranchCompany(int idCompany)
    {
        try
        {
            var result = await _storesService.GetStoresByCompanyBranches(idCompany);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stores for Company {idCompany}", idCompany);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("branch/{branchId}")]
    public async Task<ActionResult<List<object>>> GetByBranch(int branchId)
    {
        try
        {
            var result = await _storesService.GetByBranch(branchId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving stores for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpGet("{id}")]
    public async Task<ActionResult<Stores>> GetById(int id)
    {
        try
        {
            var store = await _storesService.GetById(id);
            if (store == null)
            {
                return NotFound();
            }
            return Ok(store);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving store with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Stores store)
    {
        try
        {
            await _storesService.Save(store);
            return Ok(store);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving store");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Stores store)
    {
        try
        {
            var updatedStore = await _storesService.Update(id, store);
            if (updatedStore == null)
            {
                return NotFound();
            }
            return Ok(updatedStore);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating store with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
    
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var result = await _storesService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting store with ID {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}