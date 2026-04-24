
// CustomersController.cs
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Authorization;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class CustomerController : ControllerBase
{
    private readonly ICustomerService _customerService;
    private readonly ILogger<CustomerController> _logger;

    public CustomerController(ICustomerService customerService, ILogger<CustomerController> logger)
    {
        _customerService = customerService;
        _logger = logger;
    }

    [HttpGet("cusorprov")]
    public async Task<ActionResult<List<object>>> GetByCompanyCP(int idCompany, string type)
    {
        try
        {
            var result = await _customerService.GetProvidersByCompany(idCompany, type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for branch {idCompnay}", idCompany);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("palacio")]
    public async Task<ActionResult<List<object>>> GetByCompanyPalace(int idCompany)
    {
        try
        {
            var result = await _customerService.GetByCompanyforPalace(idCompany);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for branch {idCompnay}", idCompany);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("branch/{branchId}")]
    public async Task<ActionResult<List<object>>> GetByBranch(int branchId, string type)
    {
        try
        {
            var result = await _customerService.GetByBranchCust(branchId, type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("branchCompany/{branchId}/{Company}")]
    public async Task<ActionResult<List<object>>> GetByBranchCompany(int branchId, string Company, string type)
    {
        try
        {
            var result = await _customerService.GetByBranchCompanyCust(branchId, Company, type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for branch {BranchId}", branchId);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("active")]
    public async Task<IActionResult> GetActiveCustomers(int idBranch, string type)
    {
        try
        {
            var result = await _customerService.GetActiveCustomers(idBranch, type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while retrieving active customers");
            return StatusCode(500, "An error occurred while processing your request");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Customer>> GetById(int id)
    {
        try
        {
            var customer = await _customerService.GetById(id);
            if (customer == null)
            {
                return NotFound();
            }
            return Ok(customer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customer {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPost]
    public async Task<ActionResult<Customer>> Create([FromBody] Customer customer)
    {
        try
        {
            await _customerService.Save(customer);
            return Ok(customer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating customer");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<Customer>> Update(int id, [FromBody] Customer customer)
    {
        try
        {
            var updatedCustomer = await _customerService.Update(id, customer);
            if (updatedCustomer == null)
            {
                return NotFound();
            }
            return Ok(updatedCustomer);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _customerService.Delete(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting customer {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet("company")]
    public async Task<ActionResult<List<object>>> GetByCompany(int idCompany, string Type)
    {
        try
        {
            var result = await _customerService.GetByCompany(idCompany, Type);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving customers for company {CompanyId}");
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }

    [HttpGet]
    [Route("GetTypeCustomer")]
    public async Task<ActionResult<List<CombinedData>>> GetCombinedData(int idCompany)
    {
        try
        {


            var result = await _customerService.GetCombinedData(idCompany);

            if (result == null || result.Count == 0)
            {
                return NotFound($"No se encontraron datos para la compañía {idCompany} ");
            }

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error al obtener datos combinados para idCompany={idCompany}");
            return StatusCode(500, "Ocurrió un error al procesar la solicitud. Por favor, inténtelo de nuevo más tarde.");
        }
    }
    [HttpPut("Increment/{id}/{type}")]
    public async Task<IActionResult> Increment(int id, string type, string operacion)
    {
        try
        {
            await _customerService.Increment(id, type, operacion);
            return Ok();
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Argument error during increment for customer {Id}", id);
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating customer {Id}", id);
            return StatusCode(500, "An error occurred while processing your request.");
        }
    }
}