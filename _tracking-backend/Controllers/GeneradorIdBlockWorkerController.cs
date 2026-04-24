using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using System.Threading.Tasks;

namespace MicroServicioTracking.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class GeneradorIdBlockWorkerController : ControllerBase
    {
        private readonly IGeneradorIdBlockWorkerService _workerService;

        public GeneradorIdBlockWorkerController(IGeneradorIdBlockWorkerService workerService)
        {
            _workerService = workerService;
        }

        [HttpPost("generar")]
        public async Task<IActionResult> GenerarBloques()
        {
            await _workerService.GenerateAutomaticIdBlock();
            return Ok("Bloques generados correctamente.");
        }
    }
}