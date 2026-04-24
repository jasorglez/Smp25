using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PresupuestoController : ControllerBase
    {
        private readonly IPresupuestoService _service;
        private readonly ILogger<PresupuestoController> _logger;

        public PresupuestoController(IPresupuestoService service, ILogger<PresupuestoController> logger)
        {
            _service = service;
            _logger = logger;
        }

        // ── PRESUPUESTO HEADER ────────────────────────────────────────────────

        [HttpGet("getAll/{idCompany}/{idProject}")]
        public async Task<IActionResult> GetAll(int idCompany, int idProject)
        {
            var result = await _service.GetAll(idCompany, idProject);
            return Ok(result);
        }

        [HttpGet("getVigente/{idCompany}/{idProject}")]
        public async Task<IActionResult> GetVigente(int idCompany, int idProject)
        {
            var result = await _service.GetVigente(idCompany, idProject);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpGet("getById/{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _service.GetById(id);
            if (result == null) return NotFound();
            return Ok(result);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] PresupuestoForm data)
        {
            try
            {
                _logger.LogInformation("Create presupuesto: idProject={IdProject}, idCompany={IdCompany}, nombre={Nombre}, vigente={Vigente}",
                    data?.IdProject, data?.IdCompany, data?.Nombre, data?.Vigente);
                var result = await _service.Create(data);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear presupuesto: {Message} | Inner: {Inner}", ex.Message, ex.InnerException?.Message);
                return StatusCode(500, new { error = ex.Message, inner = ex.InnerException?.Message });
            }
        }

        [HttpPut("update/{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] PresupuestoForm data)
        {
            var ok = await _service.Update(id, data);
            if (!ok) return NotFound();
            return Ok();
        }

        [HttpPut("setVigente/{id}")]
        public async Task<IActionResult> SetVigente(int id, [FromBody] SetVigenteRequest req)
        {
            var ok = await _service.SetVigente(id, req.IdCompany, req.IdProject);
            if (!ok) return NotFound();
            return Ok();
        }

        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var ok = await _service.Delete(id);
            if (!ok) return NotFound();
            return Ok();
        }

        // ── LÍNEAS ────────────────────────────────────────────────────────────

        [HttpGet("lineas/{idPresupuesto}")]
        public async Task<IActionResult> GetLineas(int idPresupuesto)
        {
            var result = await _service.GetLineas(idPresupuesto);
            return Ok(result);
        }

        [HttpPost("lineas")]
        public async Task<IActionResult> CreateLinea([FromBody] PresupuestoLineaForm data)
        {
            var result = await _service.CreateLinea(data);
            return Ok(result);
        }

        [HttpPut("lineas/update/{id}")]
        public async Task<IActionResult> UpdateLinea(int id, [FromBody] PresupuestoLineaForm data)
        {
            var ok = await _service.UpdateLinea(id, data);
            if (!ok) return NotFound();
            return Ok();
        }

        [HttpDelete("lineas/delete/{id}")]
        public async Task<IActionResult> DeleteLinea(int id)
        {
            var ok = await _service.DeleteLinea(id);
            if (!ok) return NotFound();
            return Ok();
        }

        // ── DISTRIBUCIÓN MENSUAL ──────────────────────────────────────────────

        [HttpGet("meses/{idLinea}")]
        public async Task<IActionResult> GetMeses(int idLinea)
        {
            var result = await _service.GetMeses(idLinea);
            return Ok(result);
        }

        [HttpPost("meses/{idLinea}")]
        public async Task<IActionResult> SaveMeses(int idLinea, [FromBody] List<PresupuestoMes> meses)
        {
            await _service.SaveMeses(idLinea, meses);
            return Ok();
        }

        // ── PREREGISTRO DE GASTO ──────────────────────────────────────────────

        [HttpGet("preregistro/{idCompany}/{idProject}")]
        public async Task<IActionResult> GetPreregistros(int idCompany, int idProject)
        {
            var result = await _service.GetPreregistros(idCompany, idProject);
            return Ok(result);
        }

        [HttpPost("preregistro")]
        public async Task<IActionResult> CreatePreregistro([FromBody] PreregistroGasto data)
        {
            var result = await _service.CreatePreregistro(data);
            return Ok(result);
        }

        [HttpPut("preregistro/update/{id}")]
        public async Task<IActionResult> UpdatePreregistro(int id, [FromBody] PreregistroGasto data)
        {
            var ok = await _service.UpdatePreregistro(id, data);
            if (!ok) return NotFound();
            return Ok();
        }

        [HttpDelete("preregistro/delete/{id}")]
        public async Task<IActionResult> DeletePreregistro(int id)
        {
            var ok = await _service.DeletePreregistro(id);
            if (!ok) return NotFound();
            return Ok();
        }

        // ── MIGRACIONES ───────────────────────────────────────────────────────

        [HttpGet("migraciones/{idPresupuesto}")]
        public async Task<IActionResult> GetMigraciones(int idPresupuesto)
        {
            var result = await _service.GetMigraciones(idPresupuesto);
            return Ok(result);
        }

        [HttpPost("migraciones")]
        public async Task<IActionResult> EjecutarMigracion([FromBody] MigracionForm data)
        {
            var result = await _service.EjecutarMigracion(data);
            if (result == null) return NotFound();
            return Ok(result);
        }

        // ── INCREMENTOS ───────────────────────────────────────────────────────

        [HttpGet("incrementos/{idPresupuesto}")]
        public async Task<IActionResult> GetIncrementos(int idPresupuesto)
        {
            var result = await _service.GetIncrementos(idPresupuesto);
            return Ok(result);
        }

        [HttpPost("incrementos")]
        public async Task<IActionResult> SolicitarIncremento([FromBody] IncrementoForm data)
        {
            var result = await _service.SolicitarIncremento(data);
            return Ok(result);
        }

        [HttpPut("incrementos/autorizar/{id}")]
        public async Task<IActionResult> AutorizarIncremento(int id, [FromBody] UsuarioRequest req)
        {
            var ok = await _service.AutorizarIncremento(id, req.Usuario);
            if (!ok) return NotFound();
            return Ok();
        }

        [HttpPut("incrementos/rechazar/{id}")]
        public async Task<IActionResult> RechazarIncremento(int id, [FromBody] UsuarioRequest req)
        {
            var ok = await _service.RechazarIncremento(id, req.Usuario);
            if (!ok) return NotFound();
            return Ok();
        }

        // ── REPORTE DE DESEMPEÑO ──────────────────────────────────────────────

        [HttpGet("reporte/{idCompany}/{idProject}")]
        public async Task<IActionResult> GetReporteDesempeno(int idCompany, int idProject)
        {
            var result = await _service.GetReporteDesempeno(idCompany, idProject);
            return Ok(result);
        }

        // ── SALDO DISPONIBLE ──────────────────────────────────────────────────

        [HttpGet("saldo/{idCompany}/{idProject}/{idCuenta}")]
        public async Task<IActionResult> GetSaldoDisponible(int idCompany, int idProject, int idCuenta)
        {
            var saldo = await _service.GetSaldoDisponible(idCompany, idProject, idCuenta);
            return Ok(new { saldo });
        }
    }

    // ── Request helpers ───────────────────────────────────────────────────────

    public class SetVigenteRequest
    {
        public int IdCompany { get; set; }
        public int IdProject { get; set; }
    }

    public class UsuarioRequest
    {
        public string Usuario { get; set; } = string.Empty;
    }
}
