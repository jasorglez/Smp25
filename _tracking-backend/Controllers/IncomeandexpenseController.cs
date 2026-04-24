
using MicroServicioTracking.Hubs;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.DTOs.MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class IncomeandexpenseController : ControllerBase
    {
        private readonly IIncomeAndExpenseService _incomeAndExpenseService;
        private readonly IIngresosExcelService _ingresosExcelService;
        private readonly IEgresosExcelService _egresosExcelService;
        private readonly ILogger<IncomeandexpenseController> _logger;
        private readonly IHubContext<AdmonHub> _hubContext;



        public IncomeandexpenseController(IIncomeAndExpenseService incomeAndExpenseService
            , IIngresosExcelService ingresosExcelService
            , IEgresosExcelService egresosExcelService
            , ILogger<IncomeandexpenseController> logger
            , IHubContext<AdmonHub> hubContext)
        {
            _incomeAndExpenseService = incomeAndExpenseService ?? throw new ArgumentNullException(nameof(incomeAndExpenseService));
            _ingresosExcelService = ingresosExcelService ?? throw new ArgumentNullException(nameof(ingresosExcelService));
            _egresosExcelService = egresosExcelService ?? throw new ArgumentNullException(nameof(egresosExcelService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _hubContext = hubContext ?? throw new ArgumentNullException(nameof(hubContext));
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var result = await _incomeAndExpenseService.GetByIncomeandexpenseAll();
                if (result == null || !result.Any())
                {
                    return NotFound($"No income and expenses found for business.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("incomexroot")]
        public async Task<IActionResult> GetIncomexroot(int idroot)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetIncomxroot(idroot);
                if (result == null || !result.Any())
                {
                    return NotFound($"No income found for business.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        [HttpGet("expensexroot")]
        public async Task<IActionResult> GetExpensexroot(int idroot)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetExpensexroot(idroot);
                if (result == null || !result.Any())
                {
                    return NotFound($"No expenses found for business.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("Bussines/{id}")]
        public async Task<IActionResult> GetByBusiness(int id)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetByBusiness(id);
                if (result == null || !result.Any())
                {
                    return NotFound($"No income and expenses found for business ID {id}.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("Branch/{id}")]
        public async Task<IActionResult> GetBranch(int id)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetByBranch(id);
                if (result == null || !result.Any())
                {
                    return NotFound($"No income and expenses found for business ID {id}.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetById(id);
                if (result == null || !result.Any())
                {
                    return NotFound($"No income and expenses found for ID {id}.");
                }
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }
        
        [HttpGet("Bussines/balance")]
        public async Task<IActionResult> GetBalance([FromQuery] int id)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetBalanceStatement(id);
                return Ok(new
                {
                    success = true,
                    hasData = result != null && result.Any(),
                    message = result == null || !result.Any()
                        ? "No se encontraron registros para el ID proporcionado"
                        : "Datos encontrados exitosamente",
                    data = result ?? new List<object>()
                });
            }
            catch (Exception ex)
            {
                // Log the exception here
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error interno del servidor",
                    error = ex.Message
                });
            }
        }

        [HttpGet("saldo-ingresos-mes")]
        public async Task<IActionResult> GetSaldoEIngresosMes([FromQuery] int idAccount, [FromQuery] DateTime fechaInicio, [FromQuery] DateTime fechaFin)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetSaldoEIngresosMes(idAccount, fechaInicio, fechaFin);
                return Ok(new
                {
                    success = true,
                    message = "Datos obtenidos exitosamente",
                    data = result
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener saldo e ingresos del mes para Account ID {IdAccount}", idAccount);
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error interno del servidor",
                    error = ex.Message
                });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] Incomeandexpense incomeAndExpense)
        {
            if (incomeAndExpense == null)
            {
                return BadRequest("IncomeAndExpense object is null.");
            }

            try
            {
                await _incomeAndExpenseService.Save(incomeAndExpense);
                await _hubContext.Clients.All.SendAsync("ReceiveAdmonUpdate", new
                {
                    type = "income",
                    idRoot = incomeAndExpense.IdBusinnes ?? 0
                });
                return CreatedAtAction(nameof(GetByBusiness), new { id = incomeAndExpense.IdBusinnes }, incomeAndExpense);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Incomeandexpense incomeAndExpense)
        {
            if (incomeAndExpense == null)
            {
                return BadRequest("IncomeAndExpense object is null.");
            }
            if (id != incomeAndExpense.Id)
            {
                return BadRequest("IncomeAndExpense ID mismatch.");
            }

            try
            {
                var updatedTransaction = await _incomeAndExpenseService.Update(id, incomeAndExpense);
                if (updatedTransaction == null)
                {
                    return NotFound($"IncomeAndExpense with ID {id} not found.");
                }
                await _hubContext.Clients.All.SendAsync("ReceiveAdmonUpdate", new
                {
                    type = "income",
                    idRoot = incomeAndExpense.IdBusinnes ?? 0
                });
                return Ok(updatedTransaction);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }


        [HttpPatch("totals/{id}")] // Un nombre de ruta más genérico
        public async Task<IActionResult> Updateiva(int id, [FromBody] UpdateTotalsDto totalsDto)
        {
            if (totalsDto == null)
            {
                return BadRequest("IncomeAndExpense object is null.");
            }
            
            try
            {
                var updatedTransaction = await _incomeAndExpenseService.UpdateTotal(id, totalsDto);
                if (updatedTransaction == null)
                {
                    return NotFound($"IncomeAndExpense with ID {id} not found.");
                }
                return Ok(updatedTransaction);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }



        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id, [FromQuery] int idRoot = 0)
        {
            try
            {
                var result = await _incomeAndExpenseService.Delete(id);
                if (!result)
                {
                    return NotFound($"IncomeAndExpense with ID {id} not found.");
                }
                await _hubContext.Clients.All.SendAsync("ReceiveAdmonUpdate", new
                {
                    type = "delete",
                    idRoot
                });
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal server error: {ex.Message}");
            }
        }

        [HttpPatch("{id}/authorize")]
        public async Task<IActionResult> Authorize(int id, [FromBody] AuthorizationCallbackDto dto)
        {
            if (dto == null)
            {
                return BadRequest("Authorization data is null.");
            }

            try
            {
                var result = await _incomeAndExpenseService.UpdateAuthorization(id, dto);
                if (result == null)
                {
                    return NotFound($"IncomeAndExpense with ID {id} not found.");
                }

                return Ok(new
                {
                    success = true,
                    message = $"Document {id} authorization updated to {dto.Status}",
                    data = new
                    {
                        result.Id,
                        result.IdAuthorize,
                        result.AuthorizeName,
                        result.AuthorizationStatus,
                        result.RejectionReason,
                        result.AuthorizedAt
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error updating authorization",
                    error = ex.Message
                });
            }
        }

        [HttpPatch("counts/{id}")]
        public async Task<IActionResult> UpdateCounts(int id, [FromBody] UpdateCountsDto countsDto)
        {
            if (countsDto == null)
            {
                return BadRequest("Counts object is null.");
            }

            try
            {
                var updatedTransaction = await _incomeAndExpenseService.UpdateCounts(id, countsDto);
                if (updatedTransaction == null)
                {
                    return NotFound($"IncomeAndExpense with ID {id} not found.");
                }

                // Devolver solo los campos relevantes
                return Ok(new
                {
                    success = true,
                    message = "Counts updated successfully",
                    data = new
                    {
                        updatedTransaction.Id,
                        updatedTransaction.CountDocomps,
                        updatedTransaction.CountItems,
                        updatedTransaction.ModifiedBy,
                        updatedTransaction.ModifiedAt
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error updating counts",
                    error = ex.Message
                });
            }
        }
        
        [HttpGet("income-by-account")]
        public async Task<IActionResult> GetIncomeByAccount([FromQuery] int idBusiness, [FromQuery] string type, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetIncomeByAccount(idBusiness, type, startDate, endDate);
                return Ok(new
                {
                    success = true,
                    hasData = result != null && result.Any(),
                    message = result == null || !result.Any()
                        ? "No se encontraron registros para los parámetros proporcionados"
                        : "Datos encontrados exitosamente",
                    data = result ?? new List<IncomeByAccountDto>()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener datos agrupados por cuenta");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error interno del servidor",
                    error = ex.Message
                });
            }
        }

        [HttpGet("income-detail")]
        public async Task<IActionResult> GetIncomeDetailByAccount([FromQuery] int idBusiness, [FromQuery] string type, [FromQuery] string nameAccount, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            try
            {
                var result = await _incomeAndExpenseService.GetIncomeDetailByAccount(idBusiness, type, nameAccount, startDate, endDate);
                return Ok(new
                {
                    success = true,
                    hasData = result != null && result.Any(),
                    message = result == null || !result.Any()
                        ? "No se encontraron detalles para los parámetros proporcionados"
                        : "Datos encontrados exitosamente",
                    data = result ?? new List<IncomeDetailDto>()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener detalle por cuenta");
                return StatusCode(500, new
                {
                    success = false,
                    message = "Error interno del servidor",
                    error = ex.Message
                });
            }
        }

        [HttpPost("ProcesadorExcel")]
        public async Task<IActionResult> ProcesadorExcel(string FechaIncio, string FechaFin, string Type)
        {
            try
            {
                _logger.LogInformation("Procesando y descargando Excel para el rango: {FechaIncio} - {FechaFin}, Type: {Type}", FechaIncio, FechaFin, Type);

                // Procesar los datos
                var resultado = await _ingresosExcelService.ProcesadorExcel(FechaIncio, FechaFin, Type);
                _logger.LogInformation("Resultado del procesamiento: {Resultado}", resultado);

                // Obtener el archivo procesado
                /*var fileBytes = _updateExcelServiceGenerador.GetExcelFileOt();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);*/
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar y descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        [HttpPost("ProcesadorExcelEgresos")]
        public async Task<IActionResult> ProcesadorExcelEgresos(string Mes, int idCompany, string Type)
        {
            try
            {
                _logger.LogInformation("Procesando y descargando Excel para el rango: {Mes} - {idCompany}, Type: {Type}", Mes, idCompany, Type);

                // Procesar los datos
                var resultado = await _egresosExcelService.ProcesadorExcelEgresos(Mes, idCompany, Type);
                //_logger.LogInformation("Resultado del procesamiento: {Resultado}", resultado);

                // Obtener el archivo procesado
                /*var fileBytes = _updateExcelServiceGenerador.GetExcelFileOt();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);*/
                return Ok(resultado);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar y descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }

    }
}