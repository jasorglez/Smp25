using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using SMP.Models;
using SMP.Services;
using SMP.DtosRequest.Logbook;
using System.ComponentModel.DataAnnotations;
using SMP.Models.TD;

namespace SMP.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LogbookController : ControllerBase
    {
        private readonly ILogbookService _logbookService;
        private readonly ILogger<LogbookController> _logger;

        public LogbookController(ILogbookService logbookService, ILogger<LogbookController> logger)
        {
            _logbookService = logbookService;
            _logger = logger;
        }

        [HttpGet("reportsOt")]
        public async Task<ActionResult<List<otandlogbookxreport>>> GetAllReports(
         [FromQuery] int idCompany,
         [FromQuery] DateTime fecha1,
         [FromQuery] DateTime fecha2)
        {
            try
            {
                var rep = await _logbookService.GetOtReportsByCompany(idCompany, fecha1, fecha2);

                if (rep == null || rep.Count == 0)
                {
                    _logger.LogWarning("No reports found for company {CompanyId} between {Fecha1} and {Fecha2}", idCompany, fecha1, fecha2);
                    return NotFound(new { Message = "No data found", OTs = new List<object>() });
                }

                return Ok(rep);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving reports for company {CompanyId}", idCompany);
                return StatusCode(500, "An error occurred while retrieving Reports.");
            }
        }



        [HttpGet("projects/{projectId:int}/photos/count")]
        public async Task<IActionResult> GetPhotoCountForProject(int projectId)
        {
            try
            {
                if (projectId <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var count = await _logbookService.GetPhotoCountForProject(projectId);
                return Ok(new { success = true, data = count, message = "Conteo obtenido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetPhotoCountForProject");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("ots/{otId:int}/photos/count")]
        public async Task<IActionResult> GetPhotoCountForOt(int otId)
        {
            try
            {
                if (otId <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var count = await _logbookService.GetPhotoCountForOt(otId);
                return Ok(new { success = true, data = count, message = "Conteo obtenido" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetPhotoCountForOt");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("search")]
        public async Task<IActionResult> GetLogbooks([FromQuery] LogbookSearchRequest request)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    var errors = ModelState.SelectMany(x => x.Value.Errors.Select(e => e.ErrorMessage));
                    return BadRequest(new { success = false, message = "Datos inv�lidos", errors });
                }

                var logbooks = await _logbookService.Showlogbook(request.Date, request.Id, request.Type);

                if (!logbooks.Any())
                    return Ok(new { success = true, data = new List<Logbook>(), message = "No se encontraron datos" });

                return Ok(new { success = true, data = logbooks, message = $"Se encontraron {logbooks.Count} registros" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogbooks");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("ots/{otId:int}/photos")]
        public async Task<IActionResult> GetLogPhotosByOt(int otId, [FromQuery, Required] DateTime date)
        {
            try
            {
                if (otId <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var photos = await _logbookService.ShowLogPhotosByOt(date, otId);

                if (!photos.Any())
                    return Ok(new { success = true, data = new List<Logbook>(), message = "No se encontraron fotos" });

                return Ok(new { success = true, data = photos, message = $"Se encontraron {photos.Count} fotos" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogPhotosByOt");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("projects/{projectId:int}/photos")]
        public async Task<IActionResult> GetLogPhotosByProject(int projectId, [FromQuery, Required] DateTime date)
        {
            try
            {
                if (projectId <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var photos = await _logbookService.showlogPhotosByProject(date, projectId);

                if (!photos.Any())
                    return Ok(new { success = true, data = new List<Logbook>(), message = "No se encontraron fotos" });

                return Ok(new { success = true, data = photos, message = $"Se encontraron {photos.Count} fotos" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogPhotosByProject");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateLogbook([FromBody] Logbook logbook)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    var errors = ModelState
                        .SelectMany(x => x.Value.Errors.Select(e => e.ErrorMessage));

                    return BadRequest(new
                    {
                        success = false,
                        message = "Datos inválidos",
                        errors
                    });
                }

                await _logbookService.Save(logbook);

                return Ok(new
                {
                    success = true,
                    message = "Logbook creado exitosamente",
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear logbook");

                return StatusCode(500, new
                {
                    success = false,
                    message = "Error interno"
                });
            }
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateLogbook(int id, [FromBody] Logbook objectupdate)
        {
            try
            {
                if (id <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                if (!ModelState.IsValid)
                {
                    var errors = ModelState.SelectMany(x => x.Value.Errors.Select(e => e.ErrorMessage));
                    return BadRequest(new { success = false, message = "Datos inv�lidos", errors });
                }

                var updated = await _logbookService.Update(id, objectupdate);

                if (!updated)
                    return NotFound(new { success = false, message = "Logbook no encontrado" });

                return Ok(new { success = true, message = "Logbook actualizado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar logbook");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteLogbook(int id)
        {
            try
            {
                if (id <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                await _logbookService.Delete(id);

                return Ok(new { success = true, message = "Logbook eliminado exitosamente" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar logbook");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("ots/{otId:int}")]
        public async Task<IActionResult> GetLogbooksByOt(int otId, [FromQuery] string typeNote = null)
        {
            try
            {
                if (otId <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var logbooks = await _logbookService.GetLogbooksByOt(otId, typeNote);

                if (!logbooks.Any())
                    return Ok(new { success = true, data = new List<Logbook>(), message = "No se encontraron registros" });

                var message = string.IsNullOrEmpty(typeNote)
                    ? $"Se encontraron {logbooks.Count} registros"
                    : $"Se encontraron {logbooks.Count} registros de tipo '{typeNote}'";

                return Ok(new { success = true, data = logbooks, message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogbooksByOt");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("ots/{otId:int}/media/download")]
        public async Task<IActionResult> GetMediaByOt(int otId)
        {
            try
            {
                if (otId <= 0)
                {
                    _logger.LogWarning("Invalid OT ID: {OtId}", otId);
                    return BadRequest(new { success = false, message = "ID de OT inválido" });
                }

                _logger.LogInformation("Requesting media download for OT ID: {OtId}", otId);

                var result = await _logbookService.GetMediaByOt(otId);

                if (!result.Success)
                {
                    _logger.LogWarning("Media download failed for OT ID: {OtId}. Message: {Message}", otId, result.Message);
                    return NotFound(new {
                        success = false,
                        message = result.Message,
                        fileCount = result.FileCount
                    });
                }

                _logger.LogInformation("Media download successful for OT ID: {OtId}. Files: {FileCount}, Failed: {FailedCount}",
                    otId, result.FileCount, result.FailedCount);

                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    data = new
                    {
                        zipFileName = result.ZipFileName,
                        downloadUrl = result.DownloadUrl,
                        fileCount = result.FileCount,
                        failedCount = result.FailedCount
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al generar ZIP de media para OT ID: {OtId}", otId);
                return StatusCode(500, new {
                    success = false,
                    message = "Error interno al procesar la solicitud",
                    error = ex.Message
                });
            }
        }

        [HttpGet("reporte/{IdReporte:int}")]
        public async Task<IActionResult> GetLogbooksByReporte(int IdReporte, [FromQuery] string typeNote = null)
        {
            try
            {
                if (IdReporte <= 0)
                    return BadRequest(new { success = false, message = "ID inv�lido" });

                var logbooks = await _logbookService.GetLogbooksByReporte(IdReporte, typeNote);

                if (!logbooks.Any())
                    return Ok(new { success = true, data = new List<Logbook>(), message = "No se encontraron registros" });

                var message = string.IsNullOrEmpty(typeNote)
                    ? $"Se encontraron {logbooks.Count} registros"
                    : $"Se encontraron {logbooks.Count} registros de tipo '{typeNote}'";

                return Ok(new { success = true, data = logbooks, message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogbooksByOt");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetLogbookById(int id)
        {
            try
            {
                if (id <= 0)
                    return BadRequest(new { success = false, message = "ID inválido" });

                var logbook = await _logbookService.GetLogbookById(id);

                if (logbook == null)
                    return NotFound(new { success = false, message = "Logbook no encontrado" });

                return Ok(new { success = true, data = logbook, message = "Logbook encontrado" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error en GetLogbookById");
                return StatusCode(500, new { success = false, message = "Error interno" });
            }
        }
    }
}