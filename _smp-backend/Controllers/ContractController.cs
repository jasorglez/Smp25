
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using static System.Net.Mime.MediaTypeNames;

namespace SMP.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ContractController : ControllerBase
    {
        private readonly IContractService _contractService;
        private readonly ILogger<ContractController> _logger;

        public ContractController(IContractService contractService, ILogger<ContractController> logger)
        {
            _contractService = contractService ?? throw new ArgumentNullException(nameof(contractService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> ContractByRoot(int idBranch)
        {
            try
            {
                var contract = await _contractService.GetContracts(idBranch);
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }

        [HttpGet("totales")]
        public async Task<ActionResult<List<object>>> ContractByAmount(int idBranch)
        {
            try
            {
                var contract = await _contractService.GetAmount(idBranch);
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }

        [HttpGet("totalesxspeciality")]
        public async Task<ActionResult<List<object>>> AmountxSpeciality (int idBranch)
        {
            try
            {
                var contract = await _contractService.GetAmountxSpeciality(idBranch);
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }

        [HttpGet("state")]
        public async Task<ActionResult<List<object>>> Contract49(int idBranch)
        {
            try
            {
                var contract = await _contractService.GetContractStateAnalysis(idBranch);
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }

        [HttpGet("countxstate")]
        public async Task<ActionResult<List<object>>> ContractxState()
        {
            try
            {
                var contract = await _contractService.GetContractCountByOilfieldState();
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }


        [HttpGet("provider")]
        public async Task<IActionResult> ProjectsxContract(int provider)
        {
            try
            {
                var projectExists = await _contractService.GetContractsxProvider(provider);
                if (projectExists == null || projectExists.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contract = new List<object>() });
                }
                return Ok(projectExists);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if Project exists");
                return StatusCode(500, "An error occurred while checking if Project exists");
            }
        }


        [HttpGet("{id:int}")]
        public async Task<ActionResult<object>> GetById(int id)
        {
            try
            {
                var contract = await _contractService.GetById(id);
                if (contract == null)
                    return NotFound(new { Message = "Contract not found", id });
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contract with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the Contract");
            }
        }

        [HttpGet("2fields")]
        public async Task<ActionResult<List<object>>> Contract2fields(int idBranch)
        {
            try
            {
                var contract = await _contractService.Contract2fields(idBranch);
                if (contract == null || contract.Count == 0)
                {
                    _logger.LogWarning("No Contracts found or the result is empty");
                    return NotFound(new { Message = "No data found", Contracts = new List<object>() });
                }
                return Ok(contract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts for company");
                return StatusCode(500, "An error occurred while retrieving Contracts");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Contract cont)
        {
            try
            {
                await _contractService.Save(cont);
                return Ok (new {Message ="Record New with Id", id = cont.Id, contract = cont });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Contract");
                return StatusCode(500, "An error occurred while creating the contract");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Contract cont)
        {
            
            try
            {
                var updatedContract = await _contractService.Update(id, cont);
                if (updatedContract == null)
                {
                    return NotFound();
                }
                return Ok(updatedContract);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Contract with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Contract.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            
            try
            {
                var success = await _contractService.Delete(id);
                if (success)
                {                    
                    return Ok(new { Message = "Delete Record with Id", id  });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Contracts with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating Contracts");
            }
        }

    }
}