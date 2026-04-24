
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Services;
using SMP.Models;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ProvidersController : ControllerBase
    {
        private readonly IProviderService _providerService;
        private readonly ILogger _logger;

        public ProvidersController(IProviderService providerService, ILogger<ProvidersController> logger)
        {
            _providerService = providerService ?? throw new ArgumentNullException(nameof(providerService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
              
        [HttpGet]
        public async Task<ActionResult<List<object>>> Get([FromQuery] int idRoot)
        {
            try
            {
                var providers = await _providerService.Get(idRoot);
                if (providers == null || providers.Count == 0)
                {
                    _logger.LogWarning("No companies found or the result is empty");
                    return NotFound(new { Message = "No data found", Companies = new List<object>() });
                }
                if (providers.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more companies have null Active field");
                }
                return Ok(providers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving companies");
                return StatusCode(500, "An error occurred while retrieving companies.");
            }
        }

        [HttpGet("3fields")]
        public async Task<ActionResult<List<object>>> Type([FromQuery] string type, [FromQuery] int idRoot)
        {
            try
            {
                var providers = await _providerService.GetType(type, idRoot);
                if (providers == null || providers.Count == 0)
                {
                    _logger.LogWarning("No companies found or the result is empty");
                    return NotFound(new { Message = "No data found", Companies = new List<object>() });
                }
                
                return Ok(providers);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving companies");
                return StatusCode(500, "An error occurred while retrieving companies.");
            }
        }
        
        [HttpGet("{id}")]
        public async Task<ActionResult<Provider>> GetById(int id)
        {
            try
            {
                var provider = await _providerService.GetById(id);
        
                if (provider == null)
                {
                    _logger.LogWarning("Provider not found with ID {Id}", id);
                    return NotFound(new { Message = "Provider not found", Id = id });
                }
        
                return Ok(provider);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Provider with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the Provider.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> CreateCompany([FromBody] Provider company)
        {
            try
            {
                await _providerService.Save(company);
                return CreatedAtAction(nameof(Get), new { id = company.Id }, company);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating company");
                return StatusCode(500, "An error occurred while creating the company.");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Provider provider)
        {
           
            try
            {
                var updatedProvider = await _providerService.Update(id, provider);
                if (updatedProvider == null)
                {
                    return NotFound();
                }
                return Ok(updatedProvider);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Provider with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Provider.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]

        public async Task<IActionResult> Delete(int id)
        {
            
            try
            {
                var success= await _providerService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id  });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id  });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Providers with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Providers");
            }
        }

    }
}