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
    public class GruposCorporativosController : ControllerBase
    {
        private readonly IGruposCorporativosService _service;
        private readonly ILogger<GruposCorporativosController> _logger;

        public GruposCorporativosController(IGruposCorporativosService service, ILogger<GruposCorporativosController> logger)
        {
            _service = service;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var result = await _service.GetAll();
                if (result == null || result.Count == 0)
                {
                    _logger.LogWarning("No GruposCorporativos found");
                    return NotFound(new { Message = "No GruposCorporativos found", Data = new List<object>() });
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving GruposCorporativos");
                return StatusCode(500, "An error occurred while retrieving GruposCorporativos.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetById(id);
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] GruposCorporativo entity)
        {
            var created = await _service.Save(entity);
            return Ok(created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] GruposCorporativo entity)
        {
            if (id != entity.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updated = await _service.Update(id, entity);
                if (updated == null)
                {
                    return NotFound();
                }
                return Ok(updated);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating GruposCorporativo with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the GruposCorporativo.");
            }
        }
    }
}
