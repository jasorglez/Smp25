
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
    public class OilfieldController : ControllerBase
    {
        private readonly IOilfieldService _oilfieldService;
        private readonly ILogger _logger;

        public OilfieldController(IOilfieldService oilfieldService, ILogger<OilfieldController> logger)
        {
            _oilfieldService = oilfieldService ?? throw new ArgumentNullException(nameof(oilfieldService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> Oilfield()
        {
            try
            {
                var oi = await _oilfieldService.Oilfield();
                if (oi == null)
                {
                    _logger.LogWarning("No Oilfield found or the result is empty");
                    return NotFound(new { Message = "No data found", Oilfield = new List<object>() });
                }
                if (oi.Any(c => c.Active == null))
                {
                    throw new InvalidOperationException("One or more companies have null Active field");
                }
                return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields");
                return StatusCode(500, "An error occurred while retrieving Oilfields.");
            }
        }

        [HttpGet("contractxamount")]
        public async Task<ActionResult<List<object>>> OilfieldxContract()
        {
            try
            {
                var oi = await _oilfieldService.GetContractProjectsAsync();
                if (oi == null)
                {
                    _logger.LogWarning("No Oilfield found or the result is empty");
                    return NotFound(new { Message = "No data found", Oilfield = new List<object>() });
                }
              
                return Ok(oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields");
                return StatusCode(500, "An error occurred while retrieving Oilfields.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Oilfield oi)
        {
            try
            {
                await _oilfieldService.Save(oi);
                return CreatedAtAction(nameof(Oilfield), new { id = oi.Id }, oi);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Oilfield");
                return StatusCode(500, "An error occurred while creating the Oilfield.");
            }
        }

        // Controller method
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Oilfield oi)
        {
         
            try
            {
                var result = await _oilfieldService.Update(id, oi);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Oilfield with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Oilfield.");
            }
        }

        [HttpGet("contract/{contractId}")]
        public async Task<ActionResult<List<Oilfield>>> GetOilfieldsByContractId(int contractId)
        {
            try
            {
                var oilfields = await _oilfieldService.GetOilfieldsByContractId(contractId);
                if (oilfields == null || !oilfields.Any())
                {
                    _logger.LogWarning("No Oilfields found for ContractId {ContractId}", contractId);
                    return NotFound(new { Message = "No oilfields found for the specified contract", ContractId = contractId });
                }
                return Ok(oilfields);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by ContractId {ContractId}", contractId);
                return StatusCode(500, "An error occurred while retrieving oilfields by contract.");
            }
        }

        [HttpGet("project/{projectId}")]
        public async Task<ActionResult<List<Oilfield>>> GetOilfieldsByProjectId(int projectId)
        {
            try
            {
                var oilfields = await _oilfieldService.GetOilfieldsByProjectId(projectId);
                if (oilfields == null || !oilfields.Any())
                {
                    _logger.LogWarning("No Oilfields found for ProjectId {ProjectId}", projectId);
                    return NotFound(new { Message = "No oilfields found for the specified project", ProjectId = projectId });
                }
                return Ok(oilfields);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by ProjectId {ProjectId}", projectId);
                return StatusCode(500, "An error occurred while retrieving oilfields by project.");
            }
        }

        [HttpGet("oil/{oilId}")]
        public async Task<ActionResult<List<Oilfield>>> GetOilfieldsById(int oilId)
        {
            try
            {
                var oilfields = await _oilfieldService.GetOilfieldsById(oilId);
                if (oilfields == null || !oilfields.Any())
                {
                    _logger.LogWarning("No Oilfields found for Oil {oilId}", oilId);
                    return NotFound(new { Message = "No oilfields found for the specified project", oilId = oilId });
                }
                return Ok(oilfields);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by ProjectId {oilId}", oilId);
                return StatusCode(500, "An error occurred while retrieving oilfields by project.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
         try
            {
                var success = await _oilfieldService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id = id });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id = id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Oilfield with ID ", id);
                return StatusCode(500, "An error occurred while updating Oilfield");
            }
        }


    }
}