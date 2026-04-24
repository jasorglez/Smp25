using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class EquipmentController : ControllerBase
    {
        private readonly IEquipmentService _equipmentService;
        private readonly ILogger<EquipmentController> _logger;

        public EquipmentController(IEquipmentService equipmentService, ILogger<EquipmentController> logger)
        {
            _equipmentService = equipmentService ?? throw new ArgumentNullException(nameof(equipmentService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> Get()
        {
            try
            {
                var equipments = await _equipmentService.Get();
                if (equipments == null || !equipments.Any())
                {
                    _logger.LogWarning("No Equipment found or the result is empty");
                    return NotFound(new { Message = "No data found", Equipment = new List<object>() });
                }

                return Ok(equipments);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments");
                return StatusCode(500, "An error occurred while retrieving Equipments.");
            }
        }

        [HttpGet("company/{companyId}")]
        public async Task<IActionResult> GetByCompany(int companyId)
        {
            if (companyId <= 0)
            {
                return BadRequest("Company ID must be greater than 0.");
            }

            try
            {
                var result = await _equipmentService.GetByCompany(companyId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for company {CompanyId}", companyId);
                return StatusCode(500, "An error occurred while retrieving Equipments.");
            }
        }

        [HttpGet("branch/{branchId}")]
        public async Task<IActionResult> GetByBranch(int branchId)
        {
            if (branchId <= 0)
            {
                return BadRequest("Branch ID must be greater than 0.");
            }

            try
            {
                var result = await _equipmentService.GetByBranch(branchId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for branch {BranchId}", branchId);
                return StatusCode(500, "An error occurred while retrieving Equipments.");
            }
        }

        [HttpGet("type/{typeId}")]
        public async Task<IActionResult> GetByType(int typeId)
        {
            if (typeId <= 0)
            {
                return BadRequest("Type ID must be greater than 0.");
            }

            try
            {
                var result = await _equipmentService.GetByType(typeId);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for type {TypeId}", typeId);
                return StatusCode(500, "An error occurred while retrieving Equipments.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Equipment equipment)
        {
            try
            {
                await _equipmentService.Save(equipment);
                return Ok(new { Message = "Equipment created successfully", id = equipment.Id, equipment });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Equipment");
                return StatusCode(500, "An error occurred while creating Equipment");
            }
        }

        [HttpPost("assets")]
        public async Task<ActionResult> CreateFromAssets([FromBody] Equipment equipment)
        {
            try
            {
                await _equipmentService.SaveFromAssets(equipment);
                return Ok(new { Message = "Asset equipment created successfully", id = equipment.Id, equipment });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating asset equipment");
                return StatusCode(500, "An error occurred while creating asset equipment");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Equipment equipment)
        {
            try
            {
                var result = await _equipmentService.Update(id, equipment);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Equipment with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Equipment.");
            }
        }

        [HttpPut("assets/{id}")]
        public async Task<IActionResult> UpdateFromAssets(int id, [FromBody] Equipment equipment)
        {
            try
            {
                var result = await _equipmentService.UpdateFromAssets(id, equipment);
                if (!result)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating asset equipment with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating asset equipment.");
            }
        }

        [HttpDelete("{id}")]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _equipmentService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Equipment deleted successfully", id });
                }

                return NotFound(new { Message = "Equipment not found", id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Equipment with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting Equipment");
            }
        }
    }
}
