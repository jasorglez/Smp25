using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Identity.Client;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class NormalPayrollsController : ControllerBase
    {
        private readonly NormalPayrollService _normalpayrollService;
        private readonly ILogger<NormalPayrollsController> _logger;

        public NormalPayrollsController(NormalPayrollService normalpayrollService, ILogger<NormalPayrollsController> logger)
        {
            _normalpayrollService = normalpayrollService;
            _logger = logger;
        }

        // Controllers/EmployeeBonusController.cs

        [HttpGet("bonus")]
        public async Task<IActionResult> GetFilteredBonuses([FromQuery] DateTime startDate, [FromQuery] DateTime endDate, [FromQuery] int idBranch)
        {
            var result = await _normalpayrollService.GetAllAsync(idBranch, startDate, endDate);
            return Ok(result);
        }

        [HttpPost("save-bonuses")]
        public async Task<IActionResult> SaveBonuses([FromBody] List<EmployeesByBonusDTO> bonuses)
        {
            // 🔍 Imprime cada objeto recibido
            foreach (var bonus in bonuses)
            {
                _logger.LogInformation($"Empleado: {bonus.IdEmployee} | Nombre: {bonus.EmployeeName} | Sucursal: {bonus.IdBranch} | Fecha: {bonus.IncidenceDate:yyyy-MM-dd} | IdBonus: {bonus.IdBonus} | Vigente: {bonus.Vigente} | Activo: {bonus.Active}");
            }

            var result = await _normalpayrollService.SaveBonusesAsync(bonuses);
            return Ok(result);
        }


        [HttpGet("download-excel/{idbranch}")]
        public async Task<IActionResult> DownloadExcel(int idbranch, [FromQuery] DateTime startDate, [FromQuery] DateTime endDate)
        {
            try
            {
                var result = await _normalpayrollService.GetPayrollExcelFile(idbranch, startDate, endDate);

                if (result == null)
                    return NotFound("Archivo de nómina no encontrado");

                var (fileContent, fileName, contentType) = result.Value;

                return File(fileContent, contentType, fileName);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al descargar el archivo Excel. IdBranch: {IdBranch}, StartDate: {StartDate}, EndDate: {EndDate}",
                    idbranch, startDate, endDate);

                return StatusCode(500, "Error interno del servidor al procesar la solicitud");
            }
        }

        [HttpGet("branch/{idBranch}")]
        public async Task<ActionResult<IEnumerable<NormalPayrollDTO>>> GetNormalPayrolls(int idBranch)
        {
            try
            {
                Console.WriteLine($"----------------------------------- CONTROLLER SE recibe el idbranch: {idBranch}");

                var payrolls = await _normalpayrollService.GetAllNormalPayrollsAsync(idBranch);
                Console.WriteLine($"----------------------------------- CONTROLLER las nominas son: {payrolls}");

                // Imprime cada elemento de la lista
                foreach (var payroll in payrolls)
                {
                    _logger.LogInformation($"Nómina: {JsonSerializer.Serialize(payroll)}");
                }

                return Ok(payrolls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all normal payroll records");
                return StatusCode(500, "Internal server error while retrieving normal payrolls");
            }
        }

        [HttpGet("employees/{normalPayrollId}")]
        public async Task<ActionResult<List<EmployeesByPayrollDTO>>> GetEmployeesByNormalPayrollId(int normalPayrollId)
        {
            Console.WriteLine($" --------------     CONTROLLER el id de la nomina es: {normalPayrollId}");
            try
            {
                var employees = await _normalpayrollService.GetEmployeesByNormalPayrollIdAsync(normalPayrollId);

                if (employees == null || !employees.Any())
                {
                    return NotFound("No se encontraron empleados para esta nómina.");
                }

                return Ok(employees);

            }
            catch (Exception ex)
            {

                return StatusCode(500, "Internal server error while retrieving normal payrolls");
            }
        }

        public class PayrollRequest
        {
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public int IdBranch { get; set; }
            public bool Closed { get; set; }
            public int IdBlockPeriod { get; set; }

             public int PayrollId { get; set; }
        }

        /*  [HttpPost("pruebaconexion")]
         public async Task<bool> TextConexion()
         {
             try
             {
                 return await _context.Database.CanConnectAsync();
             }
             catch (Exception ex)
             {
                 _logger.LogError(ex, "Error al probar la conexión a la base de datos.");
                 return false;
             }
         } */



        [HttpPost("recalculatePayroll")]
        public async Task<IActionResult> RecalculatePayroll([FromBody] RecalculatePayrollRequest request)
        {
            _logger.LogInformation($"....................... CONTROLLER estos son los valores de RECALCULATE REquest: startdate {request.StartDate} " +
                $"--- enddate {request.EndDate} ----- idbranch {request.BranchId} ----- PayrollId: {request.PayrollId} --- EmployeeId: {request.EmployeeId} " +
                $"--- PayrollData Discount: {request.PayrollData.discount} ---- PayrollData Bonus: {request.PayrollData.bonus} ---- PayrollData Savings: {request.PayrollData.savings}");

            await _normalpayrollService.CalculateNormalPayrollXEmployee(request.PayrollId, request.EmployeeId, request.StartDate, request.EndDate, request.BranchId, request.PayrollData);

            return Ok(new
            {
                success = true,
                message = $"Recalculation successful",
                data = new { }
            });
        }

        public class RecalculatePayrollRequest
        {
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
            public int BranchId { get; set; }
            public int PayrollId { get; set; }
            public int EmployeeId { get; set; }
            public PayrollData? PayrollData { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> CreateNormalPayrollAsync([FromBody] PayrollRequest request)
        {
           // _logger.LogInformation($"....................... CONTROLLER estos son los valores de request: startdate {request.StartDate} --- enddate {request.EndDate} ----- idbranch {request.IdBranch} ");

            var result = await _normalpayrollService.CreateNormalPayrollAsync(request.StartDate, request.EndDate, request.IdBranch, request.Closed ,request.IdBlockPeriod ,request.PayrollId);

            //_logger.LogInformation($"el codigo regresado por el servicio al controlador es: {result.NormalPayrollId}");
           // _logger.LogInformation($"el codigo result.Success regresado por el servicio al controlador es: {result.Success}");

            if (result.Success)
            {
                return Ok(new
                {
                    success = true,
                    message = result.Message,
                    data = new { normalPayrollId = result.NormalPayrollId }
                });
            }
            else
            {
                return BadRequest(new
                {
                    success = false,
                    message = result.Message
                });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteNormalPayroll(int id)
        {

            try
            {
                var result = await _normalpayrollService.DeleteNormalPayrollAsync(id);

                Console.WriteLine($"---------------------------------el resultado de la eliminacion es: {result}");

                if (result.Success)
                {
                    return Ok(new
                    {
                        success = true,
                        message = result.Message,
                        //data = new { normalPayrollId = result.NormalPayrollId}
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }

            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [HttpDelete("bonus/{id}")]
        public async Task<ActionResult> DeleteBonus(int id)
        {
            try
            {
                var result = await _normalpayrollService.DeleteEmployeeByBonusAsync(id);

                if (result.Success)
                {
                    return Ok(new
                    {
                        success = true,
                        message = result.Message,
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = result.Message
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting bank with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the bank");
            }
        }

        [HttpPut("NormalPayrollClosing/{id}")]
        public async Task<ActionResult> Update(int id)
        {
            try
            {
                var updatedNP = await _normalpayrollService.UpdatePayrollClosing(id);
                if (updatedNP == null)
                {
                    return StatusCode(500,"Existe empleados con pago digital en 0 que si trabajaron y que cuentan con pago por tarjeta, no se puede cerrar la nómina, favor de cargar la nomina digital.");
                }
                return Ok(updatedNP);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating NormalPayroll {id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> Update(int id, [FromBody] EmployeesxBonus bonus)
        {
            try
            {
                var updatedBonus = await _normalpayrollService.Update(id, bonus);
                if (updatedBonus == null)
                {
                    return NotFound();
                }
                return Ok(updatedBonus);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating employee bonus {Id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
        [HttpPut("UpdateSavingEmployeePayroll/{id}/{monto}")]
        public async Task<ActionResult> UpdateSavingEmployeePayroll(int id, decimal monto)
        {
            try
            {
                var updatedNP = await _normalpayrollService.UpdateSavingEmployeePayroll(id, monto);
                if (updatedNP == null)
                {
                    return NotFound();
                }
                return Ok(updatedNP);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating NormalPayroll {id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
        [HttpPut("UpdateRealDiscountEmployeePayroll/{id}/{monto}")]
        public async Task<ActionResult> UpdateRealDiscountEmployeePayroll(int id, decimal monto)
        {
            try
            {
                var updatedNP = await _normalpayrollService.UpdateRealDiscountEmployeePayroll(id, monto);
                if (updatedNP == null)
                {
                    return NotFound();
                }
                return Ok(updatedNP);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating NormalPayroll {id}", id);
                return StatusCode(500, "An error occurred while processing your request.");
            }
        }
    }
}
