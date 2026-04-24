using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;

namespace MicroServicioTracking.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PayrollController : ControllerBase
    {
        private readonly PayrollService _payrollService;
        private readonly ILogger<PayrollController> _logger;

        public PayrollController(PayrollService payrollService, ILogger<PayrollController> logger)
        {
            _payrollService = payrollService;
            _logger = logger;
        }

        [HttpPost]
        public async Task<IActionResult> CreatePayroll(PayrollDTO payrollDTO)
        {
            try
            {
                if (payrollDTO == null || payrollDTO.Empleados == null || payrollDTO.Empleados.Count == 0)
                {
                    return BadRequest("The payroll data is invalid");
                }

                Console.WriteLine($"------------------------------ entrando al controller... {payrollDTO.Periodo}");

                var payrollId = await _payrollService.ProcessPayrollAsync(payrollDTO);

                Console.WriteLine($"------------------------------ CONTROLLER, esto retorna el service: {payrollId}");


//                return CreatedAtAction(nameof(GetPayrollById), new { id = payrollId }, null);

//                return CreatedAtAction(nameof(GetPayrollById), new { id = payrollId }, null);
                return Ok(payrollId);


            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating payroll record");
                return StatusCode(500, "Internal server error while processing the payroll");
            }
        }

        [HttpPost("ExcelFile/{PayrollId}")]
        public async Task<IActionResult> UploadExcelFile(int PayrollId, [FromForm] IFormFile archivo)
        {
            try
            {

                Console.WriteLine($"------------------------------ entrando al controller de ExcelFile... file vale {archivo}");

                if (archivo == null) {
                    return BadRequest("The file is invalid");
                }

                if (PayrollId == 0) {
                   return BadRequest("The payroll Id is invalid");
                }

                Console.WriteLine($"------------------------------ entrando al controller de ExcelFile... payrollid es {PayrollId}");

                byte[] fileData;
                
                using (var memoryStream = new MemoryStream()) {
                    await archivo.CopyToAsync(memoryStream);
                    fileData = memoryStream.ToArray();

                }

                var result = await _payrollService.UpdateExcelFileAsync(PayrollId, fileData);

                if (!result) {
                    return NotFound($"Payroll record with Id {PayrollId} not found");  
                }

               Console.WriteLine($"------------------------------ Archivo actualizado correctamente para PayrollId {PayrollId}");

                return Ok(new { message = "File uploaded successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating payroll record");
                return StatusCode(500, "Internal server error while processing the payroll");
            }
        }

        [HttpGet("GetPayrollsByRange")]
        public async Task<IActionResult> GetPayrollsByRange(DateTime startDate, DateTime endDate, int idBranch)
        {
            var payrolls = await _payrollService.GetPayrollsByDateAndBranch(startDate, endDate, idBranch);
        
            payrolls ??= new List<PayrollRecord>();

            return Ok(payrolls);
        }


        
        [HttpGet("branch/{idBranch}")]
        public async Task<ActionResult<IEnumerable<PayrollRecord>>> GetPayrollById(int idBranch)
        {
            try
            {
                var payrolls = await _payrollService.GetPayrollByIdAsync(idBranch);

                //Console.WriteLine($"------------------EN CONTROLLER Payroll records retrieved: {System.Text.Json.JsonSerializer.Serialize(payrolls)}");

                if (payrolls == null || !payrolls.Any())
                {
                    return NotFound($"---------------------- CONTROLLER No payroll records found for Branch ID {idBranch}");
                }

                return Ok(payrolls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"-------------- CONTROLLER Error retrieving payroll records for Branch ID {idBranch} -- {ex}");
                return StatusCode(404, "--------------- CONTROLLER Records Not Found while retrieving the payrolls");
            }
        }
        

        /*
        [HttpGet("{id}")]
        public async Task<ActionResult<PayrollRecord>> GetPayrollById(int id, [FromQuery] int? idBranch = null)
        {
            try
            {
                Console.WriteLine($"------------------ CONTROLLER Getting payroll record with ID: {id}, IdBranch: {idBranch}");
                var payroll = await _payrollService.GetPayrollByIdAsync(id, idBranch);

                Console.WriteLine($"------------------EN CONTROLLER Payroll record retrieved: {System.Text.Json.JsonSerializer.Serialize(payroll)}");

                if (payroll == null)
                {
                    return NotFound($"---------------------- CONTROLLER Payroll record with ID {id} and IdBranch {idBranch} was not found");
                }

                return Ok(payroll);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"-------------- CONTROLLER Error retrieving payroll record with ID {id}, IdBranch {idBranch} -- {ex}");
                return StatusCode(404, "--------------- CONTROLLER Record Not Found while retrieving the payroll");
            }
        }
        

        [HttpGet]
        public async Task<ActionResult<IEnumerable<PayrollRecord>>> GetAllPayrolls([FromQuery] int? idBranch = null)
        {
            try
            {
                var payrolls = await _payrollService.GetPayrollsByBranchAsync(idBranch);
                return Ok(payrolls);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all payroll records");
                return StatusCode(500, "Internal server error while retrieving payrolls");
            }
        }*/
    }
}
