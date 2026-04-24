using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using System.Threading.Tasks;

namespace MicroServicioTracking.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GeneradorAutomaticCheckinsController : ControllerBase
    {
        private readonly IGeneradorAutomaticCheckinsService _workerService;

        public GeneradorAutomaticCheckinsController(IGeneradorAutomaticCheckinsService workerService)
        {
            _workerService = workerService;
        }

        [HttpPost("generar")]
        public async Task<IActionResult> GenerarFaltas()
        {
            await _workerService.GenerateAutomaticFaltas();
            return Ok("Faltas generadas correctamente.");
        }
    }
}