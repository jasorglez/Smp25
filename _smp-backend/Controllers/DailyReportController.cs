﻿
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using SMP.DtosRequest.DailyReport;

namespace SMP.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class DailyReportController : ControllerBase
    {
        private readonly IDailyReportService _service;
        private readonly ILogger<DailyReportController> _logger;

        public DailyReportController(IDailyReportService service, ILogger<DailyReportController> logger)
        {
            _service = service;
            _logger = logger;
        }

        // GET: api/dailyreport/xot/5
        [HttpGet("xot/{ot}")]
        public async Task<IActionResult> GetByOT(int ot)
        {
            var reports = await _service.GetXOT(ot);
            return Ok(new
            {
                success = true,
                count = reports.Count,
                data = reports
            });
        }

        [HttpGet("xproject/{project}")]
        public async Task<IActionResult> GetByProject(int project)
        {
            var reports = await _service.GetXProject(project);
            return Ok(new
            {
                success = true,
                count = reports.Count,
                data = reports
            });
        }


        [HttpGet("cost")]
        public async Task<IActionResult> GetTotalCost(int idReport)

        {
            try
            {
                var total = await _service.GetReportCostSummary(idReport);
                return Ok(new { Total = total });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting total quantity for resource {idReport}");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpGet("resource-total")]
        public async Task<IActionResult> GetResourceTotalQuantity(
            [FromQuery] int idResource,
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate)
        {
            try
            {
                var total = await _service.GetResourceTotalQuantity(idResource, startDate, endDate);
                return Ok(new { Total = total });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting total quantity for resource {idResource}");
                return StatusCode(500, "Error interno del servidor");
            }
        }
    

    // GET: api/dailyreport/5
    [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var report = await _service.GetById(id);
            if (report == null)
            {
                return Ok(new
                {
                    success = false,
                    message = "No report found with the provided ID",
                    data = (object?)null
                });
            }

            return Ok(new
            {
                success = true,
                data = report
            });
        }

        [HttpGet("ot-project/{companyId}")]
        public async Task<IActionResult> GetReporteOtProject(int companyId, [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate)
        {
            try
            {
                // Ajuste para incluir el día completo en la fecha final.
                // Si se proporciona una fecha final, se establece la hora a las 23:59:59.
                if (endDate.HasValue)
                {
                    endDate = endDate.Value.Date.AddDays(1).AddTicks(-1);
                }

                var result = await _service.GetReporteOtProject(companyId, startDate, endDate);

                if (result == null || !((IEnumerable<object>)result).Any())
                {
                    return Ok(new
                    {
                        success = false,
                        message = "No se encontraron reportes para la compañía especificada",
                        data = (object?)null
                    });
                }

                return Ok(new
                {
                    success = true,
                    data = result
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = $"Error interno del servidor: {ex.Message}",
                    data = (object?)null
                });
            }
        }


        // POST: api/dailyreport - VERSIÓN CORTA
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] DailyReport report)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new { success = false, message = "Invalid data" });
                }

                var savedReport = await _service.Save(report);

                return Ok(new
                {
                    success = true,
                    message = "Report saved successfully",
                    data = savedReport
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating daily report");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Internal server error"
                });
            }
        }


        // PUT: api/dailyreport/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DailyReport report)
        {
            var updated = await _service.Update(id, report);
            if (!updated)
            {
                return Ok(new
                {
                    success = false,
                    message = "No report found to update"
                });
            }

            return Ok(new
            {
                success = true,
                message = "Report updated successfully"
            });
        }

        [HttpPut("{id}/totalconcepts")]
        public async Task<IActionResult> UpdateTotalConcepts(int id, [FromBody] DailyReport report)
        {
            try
            {
                var success = await _service.UpdateTotalConcepts(id, report);
                if (!success)
                    return NotFound($"DailyReport with ID {id} not found");

                return Ok(new { message = "TotalPay updated successfully", totalPay = report.TotalPay });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating TotalPay for DailyReport {Id}", id);
                return StatusCode(500, "Internal server error");
            }
        }

        // PATCH: api/dailyreport/5/count
        [HttpPatch("{id}/count")]
        public async Task<IActionResult> UpdateBitacoraCount(int id, [FromBody] UpdateBitacoraCountRequest request)
        {
            var updated = await _service.UpdateBitacoraCount(id, request.TypeNote, request.Count);
            if (!updated)
                return Ok(new { success = false, message = "Reporte no encontrado o tipo inválido" });

            return Ok(new { success = true, message = "Conteo actualizado" });
        }

        // DELETE: api/dailyreport/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var deleted = await _service.Delete(id);
            if (!deleted)
            {
                return Ok(new
                {
                    success = false,
                    message = "No report found to delete"
                });
            }

            return Ok(new
            {
                success = true,
                message = "Report deleted (soft delete) successfully"
            });
        }
    }
}
