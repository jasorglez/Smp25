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
    public class RootController : ControllerBase
    {
        private readonly IRootService _rootService;
        private readonly ILogger<RootController> _logger;

        public RootController(IRootService rootService, ILogger<RootController> logger)
        {
            _rootService = rootService;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<IActionResult> GetRoot()
        {
            try
            {
                var root = await _rootService.GetRoot();

                if (root == null || root.Count == 0)
                {
                    _logger.LogWarning("No Roots found or the result is empty");
                    return NotFound(new { Message = "No Rootls found or the result is empty", Root = new List<object>() });
                }
                return Ok(root);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Root for Project");
                return StatusCode(500, "An error occurred while retrieving Root.");
            }
        }

        [HttpGet("2fields")]
        public async Task<IActionResult> fields2()
        {
            try
            {
                var root = await _rootService.Get2fields();

                if (root == null || root.Count == 0)
                {
                    _logger.LogWarning("No Roots found or the result is empty");
                    return NotFound(new { Message = "No Rootls found or the result is empty", Root = new List<object>() });
                }
                return Ok(root);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Root for Project");
                return StatusCode(500, "An error occurred while retrieving Root.");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetRootById(int id)
        {
            var root = await _rootService.GetRootById(id);
            return Ok(root);
        }

        [AllowAnonymous]
        [HttpGet("{id}/pdf-info")]
        public async Task<IActionResult> GetRootPdfInfo(int id)
        {
            var obj = await _rootService.GetRootById(id);
            if (obj is not Root root) return NotFound();
            return Ok(new
            {
                name     = root.Name,
                picture  = root.Picture,
                picture2 = root.Picture2,
                email    = root.Email,
                web      = root.Web,
            });
        }

        [HttpPost]
        public async Task<IActionResult> CreateRoot([FromBody] Root root)
        {
            var createdRoot = await _rootService.CreateRoot(root);
            return Ok(createdRoot);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Root root)
        {
            if (id != root.Id)
            {
                return BadRequest("ID in URL does not match ID in the body");
            }

            try
            {
                var updatedRoot = await _rootService.Update(id, root);
                if (updatedRoot == null)
                {
                    return NotFound();
                }
                return Ok(updatedRoot);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Root with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the Root.");
            }
        }

    }
}
