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
    public class ProcesadorExcelController : ControllerBase
    {
        private readonly IProcesadorExcel _ProcesadorExcelService;

        private readonly IProcesadorExcelInt _ProcesadorExcelIntService;
        private readonly ILogger<ProcesadorExcelController> _logger;

        public ProcesadorExcelController(IProcesadorExcel ProcesadorExcelService, IProcesadorExcelInt ProcesadorExcelIntService, ILogger<ProcesadorExcelController> logger)
        {
            _ProcesadorExcelService = ProcesadorExcelService ?? throw new ArgumentNullException(nameof(ProcesadorExcelService));
            _ProcesadorExcelIntService = ProcesadorExcelIntService ?? throw new ArgumentNullException(nameof(ProcesadorExcelIntService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }
        [HttpPost("procesar")]
        public async Task<IActionResult> ProcesarArchivoExcel(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest("No file uploaded.");
                }

                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                stream.Position = 0;

                var resultado = await _ProcesadorExcelService.ProcesarArchivoExcelAsync(stream);

                if (!string.IsNullOrEmpty(resultado.ErrorMessage))
                {
                    // Si hubo un error controlado, devuélvelo como un BadRequest.
                    return BadRequest(resultado);
                }

                // Devuelve el objeto completo (con el resumen, y el archivo en bytes si existe).
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Excel file");
                return StatusCode(500, new ProcesadorExcelResult { ErrorMessage = "Error interno del servidor: " + ex.Message });
            }
        }
        [HttpPost("procesarInt")]
        public async Task<IActionResult> ProcesarArchivoExcelInt(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest("No file uploaded.");
                }

                using var stream = new MemoryStream();
                await file.CopyToAsync(stream);
                stream.Position = 0;

                var resultado = await _ProcesadorExcelIntService.ProcesarArchivoExcelIntAsync(stream);

                if (!string.IsNullOrEmpty(resultado.ErrorMessage))
                {
                    // Si hubo un error controlado, devuélvelo como un BadRequest.
                    return BadRequest(resultado);
                }

                // Devuelve el objeto completo (con el resumen, y el archivo en bytes si existe).
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing Excel file");
                return StatusCode(500, new ProcesadorExcelResult { ErrorMessage = "Error interno del servidor: " + ex.Message });
            }
        }


    }
}