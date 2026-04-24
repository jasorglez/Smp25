using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Services;
using SMP.Models;
using SMP.Models.TD;
using SMP.Models.DTO;

namespace SMP.Controllers.TD
{

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class DatosXFechasController : ControllerBase
    {
        private readonly ILogger<DatosXFechasController> _logger;
        private readonly IDatosXFechas _datosXFechasService;
        private readonly IWebHostEnvironment _env;


        public DatosXFechasController(IDatosXFechas datosXFechasService, ILogger<DatosXFechasController> logger, IWebHostEnvironment env)
        {
            _datosXFechasService = datosXFechasService ?? throw new ArgumentNullException(nameof(datosXFechasService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _env = env ?? throw new ArgumentNullException(nameof(env));
        }
        [HttpGet("Ots/{idCompany}")]
        public async Task<ActionResult<List<object>>> GetOTs(int idCompany, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var result = await _datosXFechasService.GetOTs(idCompany, startDate, endDate);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs OTs");
                return StatusCode(500, "Internal server error");
            }
        }
        [HttpGet("DailyReports/{idCompany}")]
        public async Task<ActionResult<List<object>>> GetDailyReports(int idCompany, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                var result = await _datosXFechasService.GetDailyReports(idCompany, startDate, endDate);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Daily Reports");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}