using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using System.Threading.Tasks;

namespace MicroServicioTracking.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class IdBlockPeriodController : ControllerBase
    {
        private readonly IIdBlockPeriodService _service;

        public IdBlockPeriodController(IIdBlockPeriodService service)
        {
            _service = service;
        }

        // GET: api/IdBlockPeriod/branch/5
        [HttpGet("branch/{branchId}")]
        public async Task<IActionResult> ObtenerPorSucursal(int branchId)
        {
            var periodos = await _service.ObtenerPeriodByBranch(branchId);

            if (periodos == null || !periodos.Any())
                return NotFound(new { mensaje = "No se encontraron periodos para la sucursal." });

            return Ok(periodos);
        }

        [HttpGet("get-block-id")]
        public async Task<IActionResult> GetBlockId([FromQuery] int idEmployee, [FromQuery] DateTime date)
        {
            var blockId = await _service.GetBlockIdByBranchAndDateAsync(idEmployee, date);

            if (blockId.HasValue)
                return Ok(new { BlockId = blockId.Value });

            return NotFound("No se encontró un bloque activo para esa fecha.");
        }

        [HttpPost("CreateBlockNew")]
        public async Task<IActionResult> CreateBlockNew([FromQuery] int branchId, [FromQuery] string identificador, [FromQuery] DateTime dateStart, [FromQuery] DateTime dateEnd)
        {
            try
            {
                var blockId = await _service.CreateBlockNewAsync(branchId, identificador, dateStart, dateEnd);

                if (blockId.HasValue)
                    return Ok(new { 
                        BlockId = blockId.Value,
                        Message = "Bloque de período creado exitosamente",
                        BranchId = branchId,
                        Identificador = identificador,
                        FechaInicio = dateStart.ToString("yyyy-MM-dd"),
                        FechaFin = dateEnd.ToString("yyyy-MM-dd")
                    });

                return BadRequest("No se pudo crear el bloque de período");
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { Error = "Datos inválidos", Message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return Conflict(new { Error = "Conflicto", Message = ex.Message });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { Error = "Error interno del servidor", Message = ex.Message });
            }
        }
    }
}
