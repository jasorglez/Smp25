using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTrackingTracking.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class TrackingController : ControllerBase
    {
        private readonly ITrackingService _tracking;
        private readonly ILogger<TrackingController> _logger;

        public TrackingController(ITrackingService tracking, ILogger<TrackingController> logger)
        {
            _tracking = tracking ?? throw new ArgumentNullException(nameof(tracking));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<IEnumerable<Tracking>>> GetTrackings()
        {
            try
            {
                var tra = await _tracking.GetTrackings();                
                if (tra == null )
                {
                    _logger.LogWarning("No Tracking found or the result is empty");
                    return NotFound(new { Message = "No Tracking found or the result is empty", Logbook = new List<object>() });
                }
                return Ok(tra);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while fetching Tracking");
                return StatusCode(StatusCodes.Status500InternalServerError, "Error retrieving data from the database");
            }
        }


        // GET: api/Trackings/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Tracking>> GetTracking(int id)
        {
            var tracking = await _tracking.GetTrackingId(id);
            if (tracking == null)
            {
                return NotFound();
            }
            return Ok(tracking);
        }

        // POST: api/Trackings
        // To protect from overposting attacks, see https://go.microsoft.com/fwlink/?linkid=2123754
        [HttpPost]
        public async Task<ActionResult<Tracking>> PostTracking([FromBody] Tracking tracking)
        {
            try
            {
                await _tracking.Save(tracking);
                return Ok(tracking);
            }
            catch (Exception ex)
            {
                return BadRequest($"Error al insertar el Registro: {ex.Message}");
            }
        }

    }
}
