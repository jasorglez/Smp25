using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class BranchsController : ControllerBase
    {
        private readonly IBranchService _branchService;
        private readonly ILogger<BranchsController> _logger;

        public BranchsController(IBranchService branchService, ILogger<BranchsController> logger)
        {
            _branchService = branchService ?? throw new ArgumentNullException(nameof(branchService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("all")]
        public async Task<ActionResult<List<object>>> GetAllBranches()
        {
            try
            {
                var branches = await _branchService.GetAllBranches();
                return Ok(branches);
            }
            catch (Exception ex)
            {
                _logger.LogError("Error retrieving branches");
                return StatusCode(500, "Internal server error while retrieving branches");
            }
        }

        [HttpGet()]
        public async Task<ActionResult<List<object>>> GetBranches(int idCompany)
        {
            try
            {
                var branches = await _branchService.GetBranches(idCompany);
                return Ok(branches);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving branches for company {IdCompany}", idCompany);
                return StatusCode(500, "Internal server error while retrieving branches");
            }
        }

        [HttpGet("2fields")]
        public async Task<ActionResult<List<object>>> Get2Branches(int idCompany)
        {
            try
            {
                var branches = await _branchService.twoBranches(idCompany);
                return Ok(branches);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving branches for company {IdCompany}", idCompany);
                return StatusCode(500, "Internal server error while retrieving branches");
            }
        }
        

        [HttpPost]
        public async Task<ActionResult> CreateBranch([FromBody] Branch branch)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                await _branchService.Save(branch);
                return CreatedAtAction(nameof(GetBranches), new { idCompany = branch.IdCompany }, branch);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating branch");
                return StatusCode(500, "Internal server error while creating branch");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateBranch(int id, [FromBody] Branch branch)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                var result = await _branchService.Update(id, branch);
                if (!result)
                {
                    return NotFound($"Branch with ID {id} not found");
                }
                return Ok(branch);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating branch with ID {Id}", id);
                return StatusCode(500, "Internal server error while updating branch");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteBranch(int id)
        {

            Console.WriteLine("------------------- controller DeleteBranch called with ID: " + id);

            var eliminado = await _branchService.Delete(id);

            if (eliminado.Success)
            {
                return Ok(eliminado);
            }

            // Si la razón es que no se pudo encontrar, retornar 404
            if (eliminado.CanDelete == null || eliminado.Message.Contains("No se encontró"))
            {
                return NotFound(eliminado);
            }

            // Si hay razones de negocio para no eliminar, retornar 422 (Unprocessable Entity)
            if (eliminado.CanDelete == 0)
            {
                return UnprocessableEntity(eliminado);
            }

            // Para otros errores
            return BadRequest(eliminado);
        
        }
    }
}