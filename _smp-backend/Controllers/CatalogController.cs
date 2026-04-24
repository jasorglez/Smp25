using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
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

        // GET api/Catalog/getCatalogs?idCompany=1&type=TYPEEQUIPMENT
        [HttpGet("getCatalogs")]
        public async Task<ActionResult<List<Catalog>>> GetCatalogs(int idCompany, string type)
        {
            try
            {
                var catalogs = await _catalogService.GetType(type, idCompany);
                return Ok(catalogs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving catalogs for company {IdCompany} type {Type}", idCompany, type);
                return StatusCode(500, "Internal server error while retrieving catalogs");
            }
        }

        // GET api/Catalog/all?idCompany=1
        [HttpGet("all")]
        public async Task<ActionResult<List<Catalog>>> GetAll(int idCompany)
        {
            try
            {
                var catalogs = await _catalogService.GetTypeAll(idCompany);
                return Ok(catalogs);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all catalogs for company {IdCompany}", idCompany);
                return StatusCode(500, "Internal server error while retrieving catalogs");
            }
        }

        // POST api/Catalog
        [HttpPost]
        public async Task<ActionResult<Catalog>> Create([FromBody] Catalog catalog)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                await _catalogService.Save(catalog);
                return CreatedAtAction(nameof(GetCatalogs),
                    new { idCompany = catalog.IdCompany, type = catalog.Type },
                    catalog);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating catalog");
                return StatusCode(500, "Internal server error while creating catalog");
            }
        }

        // PUT api/Catalog/5
        [HttpPut("{id}")]
        public async Task<ActionResult<Catalog>> Update(int id, [FromBody] Catalog catalog)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            try
            {
                var updated = await _catalogService.Update(id, catalog);
                if (updated == null)
                    return NotFound($"Catalog with ID {id} not found");

                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating catalog with ID {Id}", id);
                return StatusCode(500, "Internal server error while updating catalog");
            }
        }

        // DELETE api/Catalog/5
        [HttpDelete("{id}")]
        public async Task<ActionResult> Delete(int id)
        {
            try
            {
                var deleted = await _catalogService.Delete(id);
                if (!deleted)
                    return NotFound($"Catalog with ID {id} not found");

                return Ok(new { message = "Catalog deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting catalog with ID {Id}", id);
                return StatusCode(500, "Internal server error while deleting catalog");
            }
        }
    }
}
