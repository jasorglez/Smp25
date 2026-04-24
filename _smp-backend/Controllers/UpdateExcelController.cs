using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class UpdateExcelController : ControllerBase
    {
        private readonly IUpdateExcelServiceGenerador _updateExcelServiceGenerador;
        private readonly IUpdateExcelServiceExternas _updateExcelServiceExternas;
        private readonly IUpdateExcelServiceInternas _updateExcelServiceInternas;
        private readonly ILogger<UpdateExcelController> _logger;

        public UpdateExcelController(IUpdateExcelServiceGenerador updateExcelServiceGenerador, IUpdateExcelServiceExternas updateExcelServiceExternas, IUpdateExcelServiceInternas updateExcelServiceInternas, ILogger<UpdateExcelController> logger)
        {
            _updateExcelServiceGenerador = updateExcelServiceGenerador ?? throw new ArgumentNullException(nameof(updateExcelServiceGenerador));
            _updateExcelServiceExternas = updateExcelServiceExternas ?? throw new ArgumentNullException(nameof(updateExcelServiceExternas));
            _updateExcelServiceInternas = updateExcelServiceInternas ?? throw new ArgumentNullException(nameof(updateExcelServiceInternas));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpPost("procesar")]
        public IActionResult ProcesarExcel([FromBody] ExcelDataRequestWrapper wrapper)
        {
            try
            {
                _logger.LogInformation("Procesando archivo Excel con los datos: {@Data}", wrapper.Data);
                var resultado = _updateExcelServiceGenerador.ModificarOInsertarOt(wrapper.Data);
                return Ok(new { mensaje = resultado });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
        [HttpPost("date")]
        public IActionResult SearchInterval([FromBody] DateRangeRequestType request)
        {
            try
            {
                _logger.LogInformation("Buscando registros en el rango: {DateStart} - {DateEnd} con tipo {Type}", request.DateStart, request.DateEnd, request.Type);

                var resultado = _updateExcelServiceGenerador.SearchIntervalOt(request.DateStart, request.DateEnd, request.Type);

                return Ok(new { mensaje = resultado });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al buscar registros en el intervalo de fechas.");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpGet("download")]
        public IActionResult DownloadExcel()
        {
            try
            {
                _logger.LogInformation("Descargando archivo Excel");

                var fileBytes = _updateExcelServiceGenerador.GetExcelFileOt();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("process-and-download-ot")]
        public IActionResult ProcessAndDownloadOT([FromBody] DateRangeRequestType request)
        {
            try
            {
                _logger.LogInformation("Procesando y descargando Excel para el rango: {DateStart} - {DateEnd}, Tipo: {Type}", request.DateStart, request.DateEnd, request.Type);

                // Procesar los datos
                var resultado = _updateExcelServiceGenerador.SearchIntervalOt(request.DateStart, request.DateEnd, request.Type);
                _logger.LogInformation("Resultado del procesamiento: {Resultado}", resultado);

                // Obtener el archivo procesado
                var fileBytes = _updateExcelServiceGenerador.GetExcelFileOt();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar y descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        [HttpPost("process-and-download-cuadinter")]
        public IActionResult ProcessAndDownloadCuadInter([FromBody] DateRangeRequest request)
        {
            try
            {
                _logger.LogInformation("Procesando y descargando Excel para el rango: {DateStart} - {DateEnd}", request.DateStart, request.DateEnd);

                // Procesar los datos
                var resultado = _updateExcelServiceInternas.SearchIntervalCuadInter(request.DateStart, request.DateEnd);
                _logger.LogInformation("Resultado del procesamiento: {Resultado}", resultado);

                // Obtener el archivo procesado
                var fileBytes = _updateExcelServiceInternas.GetExcelFileCuadInter();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar y descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }
        [HttpPost("process-and-download-cuadexter")]
        public IActionResult ProcessAndDownloadCuadExter([FromBody] DateRangeRequestExterna request)
        {
            try
            {
                _logger.LogInformation("Procesando y descargando Excel para el rango: {DateStart} - {DateEnd}", request.DateStart, request.DateEnd, request.Seleccionados);

                // Procesar los datos
                var resultado = _updateExcelServiceExternas.SearchIntervalCuadExter(request.DateStart, request.DateEnd, request.Seleccionados);
                _logger.LogInformation("Resultado del procesamiento: {Resultado}", resultado);

                // Obtener el archivo procesado
                var fileBytes = _updateExcelServiceExternas.GetExcelFileCuadExter();
                var fileName = $"FORMATO_GENERADOR_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
                
                return File(fileBytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al procesar y descargar el archivo Excel");
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}