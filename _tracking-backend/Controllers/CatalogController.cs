using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CatalogController : ControllerBase
    {
        private readonly ICatalogService _catalogService;
        private readonly ILogger<CatalogController> _logger;

        public CatalogController(ICatalogService catalogService, ILogger<CatalogController> logger)
        {
            _catalogService = catalogService ?? throw new ArgumentNullException(nameof(catalogService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("getCatalogs")]
        public async Task<ActionResult<List<object>>> GetWarByComp(int idCompany, string type)
        {
            try
            {
                var cat = await _catalogService.GetType(type, idCompany);
                if (cat == null || !cat.Any())
                {
                    _logger.LogWarning("No found Catalog the result is empty");
                    return NotFound(new { Message = "No Catalog Found or the result is empty", catalog = new List<object>() });
                }
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalog for Project");
                return StatusCode(500, "An error occurred while retrieving Catalog.");
            }
        }

        [HttpGet("getCatalogsxNivel")]
        public async Task<ActionResult<List<object>>> CompxNivel(int idCompany, string type, short nivel)
        {
            try
            {
                var cat = await _catalogService.GetTypexNivel(type, idCompany,nivel);
                if (cat == null || !cat.Any())
                {
                    _logger.LogWarning("No found Catalog the result is empty");
                    return NotFound(new { Message = "No Catalog Found or the result is empty", catalog = new List<object>() });
                }
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalog");
                return StatusCode(500, "An error occurred while retrieving Catalog.");
            }
        }

        [HttpGet("getParent")]
        public async Task<ActionResult<List<object>>> GetParent(int idroot, int idParent)
        {
            try
            {
                var cat = await _catalogService.GetParentId(idroot, idParent);
                if (cat == null || !cat.Any())
                {
                    _logger.LogWarning("No found Catalog the result is empty");
                    return NotFound(new { Message = "No Catalog Found or the result is empty", catalog = new List<object>() });
                }
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalog");
                return StatusCode(500, "An error occurred while retrieving Catalog.");
            }
        }

        [HttpGet("getSubParent")]
        public async Task<ActionResult<List<object>>> GetSubParent(int idroot, int idParent)
        {
            try
            {
                var cat = await _catalogService.GetSubParentId(idroot, idParent);
                if (cat == null || !cat.Any())
                {
                    _logger.LogWarning("No found Catalog the result is empty");
                    return NotFound(new { Message = "No Catalog Found or the result is empty", catalog = new List<object>() });
                }
                return Ok(cat);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Catalog");
                return StatusCode(500, "An error occurred while retrieving Catalog.");
            }
        }

        [HttpGet("getHierarchy/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<HierarchyCatalogDto>>> GetHierarchy(int idCompany)
        {
            try
            {
                var hierarchy = await _catalogService.GetHierarchy(idCompany);
                if (hierarchy == null || !hierarchy.Any())
                {
                    _logger.LogWarning("No hierarchy found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No hierarchy found for the specified company", IdCompany = idCompany });
                }

                _logger.LogInformation("Retrieved {Count} hierarchy items for company {IdCompany}", hierarchy.Count, idCompany);
                return Ok(new
                {
                    Message = "Hierarchy retrieved successfully",
                    Count = hierarchy.Count,
                    IdCompany = idCompany,
                    Data = hierarchy
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving the catalog hierarchy.");
            }
        }



        [HttpPut("update-catalog/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Catalog cat)
        {
            try
            {
                var success = await _catalogService.Update(id, cat);
                if (!success)
                {
                    return NotFound();
                }
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating catalog with ID {Id}.", id);
                return StatusCode(500, "Internal server error.");
            }
        }
             

        [HttpPost]
        public async Task<ActionResult> Create([FromBody] Catalog cat)
        {
            try
            {
                await _catalogService.Save(cat);
                return Ok(new { Message = "Record New with Id", id = cat.Id, Catalog = cat });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Catalog");
                return StatusCode(500, "An error occurred while creating the Catalog");
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
                var success = await _catalogService.Delete(id);
                if (success)
                {
                    return Ok(new { Message = "Delete Record with Id", id });
                }
                else
                {
                    return NotFound(new { Message = "Record Not Found with Id", id });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Catalog with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting Catalog");
            }
        }
    }
}
