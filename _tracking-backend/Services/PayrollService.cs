using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using System.Text.RegularExpressions;
using Microsoft.IdentityModel.Tokens;
using Microsoft.EntityFrameworkCore.Internal;
using System.Text;

namespace MicroServicioTracking.Services
{
    public class PayrollService
    {
        private readonly DbTrackingContext _context;

        public PayrollService(DbTrackingContext context)
        {
            _context = context;
        }

        public async Task<bool> UpdateExcelFileAsync(int payrollId, byte[] fileData)
        {
            var payroll = await _context.PayrollRecords.FindAsync(payrollId);
            if (payroll == null)
            {
                return false; // Registro no encontrado
            }

            payroll.ExcelFile = fileData ?? [];
            _context.PayrollRecords.Update(payroll);
            await _context.SaveChangesAsync();

            return true;
        }

        public async Task<int> ProcessPayrollAsync(PayrollDTO payrollDTO)
        {

            Console.WriteLine($"-------------------------- PROCESSPAYROLLASYNC fechas --- payrollDTO: {payrollDTO.Periodo}");

            // Extraer las fechas de inicio y fin del periodo
            (DateTime startDate, DateTime endDate) = ExtraerFechasDeNomina(payrollDTO.Periodo, payrollDTO.Ejercicio);

            Console.WriteLine($"Fechas extraídas: {startDate:yyyy-MM-dd} a {endDate:yyyy-MM-dd}");
            var tz = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");
            var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            // Create the PayrollRecord entity with PayrollEmployees instead of Employees
            var payroll = new PayrollRecord
            {
                IdBranch = payrollDTO.IdBranch,
                Company = payrollDTO.Empresa,
                Period = payrollDTO.Periodo,
                StartDate = startDate,
                EndDate = endDate,
                FiscalYear = payrollDTO.Ejercicio,
                CreatedAt = now,
                Active = true,
                PayrollEmployees = payrollDTO.Empleados.Select(e => new PayrollEmployee
                {
                    Name = e.Nombre,
                    EmployeeId = e.IdEmpleado,
                    WorkedDays = e.DiasTrabajados,
                    IntegratedDailySalary = e.SalarioDiarioIntegrado,
                    DailySalary = e.SalarioDiario,
                    Wages = e.Sueldos,
                    TotalEarnings = e.TotalPercepciones,
                    OtherIncome = e.OtrosIngresos,
                    TaxableEarnings = e.PercepcionesGravadas,
                    Article96Tax = e.ImpuestoArt96,
                    Article114Subsidy = e.SubsidioArt114,
                    TotalArticle115EmploymentSubsidy = e.TotalSubsidioPEmpleoArt115,
                    AccreditedEmploymentSubsidy = e.SubsidioPEmpleoAcreditado,
                    IncomeTax = e.ISPT,
                    EmploymentSubsidy = e.SubsidioPEmpleo,
                    MedicalInsurance = e.IMSSEnfermedad,
                    RetirementInsurance = e.IMSSCesantiaVejez,
                    SocialSecurity = e.IMSS,
                    HousingFundWithholding = e.RetencionesINFONAVIT,
                    ChildSupport = e.PensionAlimenticia,
                    NetPay = e.Neto,
                    Signature = e.Firma ?? "Sin firma"
                }).ToList()
            };

            var ArrExcelEmpleados = new List<ExcelEmpleado>();

            void PrintPayroll(PayrollRecord payroll)
            {
                Console.WriteLine($"Nómina: {payroll.Company} - Periodo: {payroll.Period}");
                Console.WriteLine($"Fechas: {payroll.StartDate:dd/MM/yyyy} - {payroll.EndDate:dd/MM/yyyy}");
                Console.WriteLine($"Año Fiscal: {payroll.FiscalYear}");
                Console.WriteLine($"Creado: {payroll.CreatedAt:dd/MM/yyyy HH:mm:ss}");
                Console.WriteLine($"Estado: {(payroll.Active ? "Activo" : "Inactivo")}");
                
                Console.WriteLine("\nEMPLEADOS:");
                foreach (var employee in payroll.PayrollEmployees)
                {
                    Console.WriteLine($"\n{employee.Name}");
                    Console.WriteLine($"  Id de empleado: {employee.EmployeeId}");
                    Console.WriteLine($"  Días trabajados: {employee.WorkedDays}");
                    Console.WriteLine($"  Salario diario: {employee.DailySalary:C}");
                    Console.WriteLine($"  Salario diario integrado: {employee.IntegratedDailySalary:C}");
                    Console.WriteLine($"  Sueldos: {employee.Wages:C}");
                    Console.WriteLine($"  Total percepciones: {employee.TotalEarnings:C}");
                    Console.WriteLine($"  Percepciones gravadas: {employee.TaxableEarnings:C}");
                    Console.WriteLine($"  ISPT: {employee.IncomeTax:C}");
                    Console.WriteLine($"  IMSS: {employee.SocialSecurity:C}");
                    Console.WriteLine($"  Neto: {employee.NetPay:C}");
                    Console.WriteLine($"  Firma: {employee.Signature}");
                    ArrExcelEmpleados.Add(new ExcelEmpleado(employee.Name));
                }
            }

            // Luego llamas a la función:
            PrintPayroll(payroll);

            // Ahora, modifica tu código existente para incluir el ID del empleado
            var payroll2 = new PayrollRecord
            {
                IdBranch = payrollDTO.IdBranch,
                Company = payrollDTO.Empresa,
                Period = payrollDTO.Periodo,
                StartDate = startDate,
                EndDate = endDate,
                FiscalYear = payrollDTO.Ejercicio,
                CreatedAt = now,
                Active = true,
                PayrollEmployees = payrollDTO.Empleados.Select(e => 
                {
                    return new PayrollEmployee
                        {
                            EmployeeId = e.IdEmpleado, // Asigna el ID del empleado
                            Name = e.Nombre,
                            WorkedDays = e.DiasTrabajados,
                            IntegratedDailySalary = e.SalarioDiarioIntegrado,
                            DailySalary = e.SalarioDiario,
                            Wages = e.Sueldos,
                            TotalEarnings = e.TotalPercepciones,
                            OtherIncome = e.OtrosIngresos,
                            TaxableEarnings = e.PercepcionesGravadas,
                            Article96Tax = e.ImpuestoArt96,
                            Article114Subsidy = e.SubsidioArt114,
                            TotalArticle115EmploymentSubsidy = e.TotalSubsidioPEmpleoArt115,
                            AccreditedEmploymentSubsidy = e.SubsidioPEmpleoAcreditado,
                            IncomeTax = e.ISPT,
                            EmploymentSubsidy = e.SubsidioPEmpleo,
                            MedicalInsurance = e.IMSSEnfermedad,
                            RetirementInsurance = e.IMSSCesantiaVejez,
                            SocialSecurity = e.IMSS,
                            HousingFundWithholding = e.RetencionesINFONAVIT,
                            ChildSupport = e.PensionAlimenticia,
                            NetPay = e.Neto,
                            Signature = e.Firma ?? "Sin firma"
                        };
                    }).ToList()
                };

            Console.WriteLine("---------------------------SERVICE ProcessPayrollAsync " + payrollDTO.IdBranch);

            // Save to the database
            _context.PayrollRecords.Add(payroll2);
            await _context.SaveChangesAsync();

            Console.WriteLine($"----------------------- SERVICE PAYROLL.. este es el ID  de la nomina digital recien creada: {payroll2.PayrollId}");

            return payroll2.PayrollId;
        }

        /// <summary>
        /// Extrae las fechas de inicio y fin a partir del texto del período de nómina
        /// </summary>
        /// <param name="textoNomina">Texto que contiene el período (ej. "NOMINA DEL 27 DE ENERO AL 02 DE FEBRERO")</param>
        /// <param name="ejercicio">Año fiscal (ej. "2025")</param>
        /// <returns>Tupla con la fecha de inicio y la fecha de fin</returns>
        private (DateTime StartDate, DateTime EndDate) ExtraerFechasDeNomina(string textoNomina, string ejercicio = null)
        {
            Console.WriteLine($"entrando a extraer texto de las nominas... {textoNomina} -- ehercicio {ejercicio}");

            if (string.IsNullOrWhiteSpace(textoNomina))
            {
                throw new ArgumentException("El texto del período de nómina no puede estar vacío");
            }

            // Normalizar el texto (mayúsculas y eliminar dobles espacios)
            textoNomina = textoNomina.ToUpper().Trim();
            textoNomina = Regex.Replace(textoNomina, @"\s+", " ");

            // Patrón regex para extraer días y meses
            var patron = @"NOMINA(?:.*?)(\d{1,2})(?:.*?)(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)(?:.*?)(\d{1,2})(?:.*?)(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)";
            
            var match = Regex.Match(textoNomina, patron);
            
            if (!match.Success || match.Groups.Count < 5)
            {
                throw new FormatException($"No se pudieron extraer las fechas del texto: '{textoNomina}'");
            }

            // Extraer valores de los grupos
            int diaInicio = int.Parse(match.Groups[1].Value);
            string mesInicioTexto = match.Groups[2].Value;
            int diaFin = int.Parse(match.Groups[3].Value);
            string mesFinTexto = match.Groups[4].Value;

            // Convertir nombres de mes a números
            int mesInicio = ConvertirMesANumero(mesInicioTexto);
            int mesFin = ConvertirMesANumero(mesFinTexto);

            // Determinar el año (considerando cambios de año entre diciembre y enero)
            int anioActual = DateTime.Now.Year;
            
            // Usar el año fiscal proporcionado en el parámetro ejercicio
            if (!string.IsNullOrEmpty(ejercicio) && int.TryParse(ejercicio, out int ejercicioFiscal))
            {
                anioActual = ejercicioFiscal;
                Console.WriteLine($"Usando año fiscal del campo Ejercicio: {anioActual}");
            }
            else
            {
                // Como respaldo, intentamos extraerlo del texto de la nómina
                var matchAnio = Regex.Match(textoNomina, @"EJERCICIO\s+(\d{4})");
                if (matchAnio.Success)
                {
                    anioActual = int.Parse(matchAnio.Groups[1].Value);
                    Console.WriteLine($"Año fiscal extraído del texto de nómina: {anioActual}");
                }
                else
                {
                    Console.WriteLine($"No se pudo determinar el año fiscal, usando el actual: {anioActual}");
                }
            }
            
            int anioInicio = anioActual;
            int anioFin = anioActual;

            // Si estamos en enero y la nómina es de diciembre, es del año anterior
            if (DateTime.Now.Month == 1 && mesInicio == 12)
            {
                anioInicio = anioActual - 1;
            }

            // Si el mes de inicio es diciembre y el de fin es enero, el fin es del año siguiente
            if (mesInicio == 12 && mesFin == 1)
            {
                anioFin = anioInicio + 1;
            }

            // Crear objetos DateTime
            var fechaInicio = new DateTime(anioInicio, mesInicio, diaInicio);
            var fechaFin = new DateTime(anioFin, mesFin, diaFin);

            // Validar que la fecha fin sea posterior a la de inicio
            if (fechaFin < fechaInicio)
            {
                throw new InvalidOperationException($"La fecha de fin ({fechaFin:dd/MM/yyyy}) es anterior a la fecha de inicio ({fechaInicio:dd/MM/yyyy})");
            }

            return (fechaInicio, fechaFin);
        }

        /// <summary>
        /// Convierte el nombre del mes en español a su número correspondiente
        /// </summary>
        private int ConvertirMesANumero(string nombreMes)
        {
            return nombreMes.ToUpper() switch
            {
                "ENERO" => 1,
                "FEBRERO" => 2,
                "MARZO" => 3,
                "ABRIL" => 4,
                "MAYO" => 5,
                "JUNIO" => 6,
                "JULIO" => 7,
                "AGOSTO" => 8,
                "SEPTIEMBRE" => 9,
                "OCTUBRE" => 10,
                "NOVIEMBRE" => 11,
                "DICIEMBRE" => 12,
                _ => throw new ArgumentException($"Nombre de mes no reconocido: {nombreMes}")
            };
        }

        public async Task<List<PayrollRecord>> GetPayrollsByDateAndBranch(DateTime startDate, DateTime endDate, int idBranch)
        {
            return await _context.PayrollRecords
                .Where(pr =>
                    pr.StartDate >= startDate.Date && pr.StartDate < startDate.Date.AddDays(1) &&
                    pr.EndDate >= endDate.Date && pr.EndDate < endDate.Date.AddDays(1) &&
                    pr.IdBranch == idBranch &&
                    pr.Active)
                .OrderByDescending(pr => pr.PayrollId)
                .ToListAsync();
        }


        public async Task<PayrollRecord> GetPayrollByIdAsyncPre(int id, int? idBranch = null)
        {

            Console.WriteLine($"---------------------------SERVICE GetPayrollByIdAsync - Id: {id}, IdBranch: {idBranch}");
            
            var query = _context.PayrollRecords
                .Where(p => p.PayrollId == id && p.Active == true);

                 // Si se proporciona un idBranch, filtramos también por ese valor
            if (idBranch.HasValue)
            {
                query = query.Where(p => p.IdBranch == idBranch.Value);
            }

           var payrollRecord = await query
                .Include(p => p.PayrollEmployees)
                .FirstOrDefaultAsync();

            //Console.WriteLine($"------------------ SERVICE Payroll record retrieved: {System.Text.Json.JsonSerializer.Serialize(payrollRecord)}");

            if (payrollRecord == null)
            {
                throw new KeyNotFoundException($"------------------- SERVICE Registro de Nómina con ID {id} y IdBranch {idBranch} no encontrado!");
            }

            return payrollRecord;
        }

        public async Task<IEnumerable<PayrollRecord>> GetPayrollByIdAsync(int idBranch)
        {
            try
            {
                if (idBranch < 0)
                {
                    var branchIdsString = await _context.ActiveBranchIds
                        .Where(a => a.idCompany == -idBranch)
                        .Select(a => a.BranchIds)
                        .FirstOrDefaultAsync();
                    
                    if (!string.IsNullOrEmpty(branchIdsString))
                    {
                        // Parsear el string separado por comas
                        var branchIds = branchIdsString?
                            .Split(',', StringSplitOptions.RemoveEmptyEntries)
                            .Select(int.Parse)
                            .ToList();

                        // Obtener todas las nóminas de todas las sucursales
                        return await _context.PayrollRecords
                            .Where(r => branchIds.Contains(r.IdBranch) && r.Active == true)
                            .Include(p => p.PayrollEmployees)
                            .OrderByDescending(p => p.CreatedAt)
                            .ToListAsync();
                    }
                }
                else
                {
                    // Obtener todas las nóminas de la sucursal específica
                    return await _context.PayrollRecords
                        .Where(r => r.IdBranch == idBranch && r.Active == true)
                        .Include(p => p.PayrollEmployees)
                        .OrderByDescending(p => p.CreatedAt)
                        .ToListAsync();
                }
            } 
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving payrolls for Branch ID {idBranch}: {ex.Message}");
                throw;
            }
            
            return new List<PayrollRecord>();
        }

        public async Task<IEnumerable<PayrollRecord>> GetAllPayrollsAsync(int? idBranch)
        {
            /*
            return await _context.PayrollRecords
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
            */
            
            var query = _context.PayrollRecords
                .Where(p => p.Active == true);
                
            // Si se proporciona un idBranch, filtramos por ese valor
            if (idBranch.HasValue)
            {
                query = query.Where(p => p.IdBranch == idBranch.Value);
            }
            
            // Ordenamos por fecha de creación descendente e incluimos los empleados
            return await query
                .Include(p => p.PayrollEmployees)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }

        public async Task<IEnumerable<PayrollRecord>> GetPayrollsByBranchAsync(int? idBranch)
        {
            var query = _context.PayrollRecords 
                .Where(p => p.Active == true);
        
            // Si se proporciona un idBranch, filtramos por ese valor
            if (idBranch.HasValue) {
                query = query.Where(p => p.IdBranch == idBranch.Value);
            }
    
            // Ordenamos por fecha de creación descendente e incluimos los empleados
            return await query
                .Include(p => p.PayrollEmployees)
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();
        }
        public async Task<PayrollRecord?> UpdateBlockPayroll(int idBlockPeriod, int PayrollId)
        {
            var entity = await _context.PayrollRecords
                .FirstOrDefaultAsync(p => p.PayrollId == PayrollId && p.Active == true);
            
            if (entity == null)
                return null;
                
            entity.IdBlockPeriod = idBlockPeriod;
            await _context.SaveChangesAsync();
            
            return entity;
        }

        // Clases de modelo (igual que antes)
        public class Empleado
        {
            public int Id { get; set; }
            public string FullName { get; set; } // Formato: Nombre Apellido1 Apellido2

            // Constructor
            public Empleado(int id, string fullName)
            {
                Id = id;
                FullName = fullName;
            }
        }

        public class ExcelEmpleado
        {
            public string FullName { get; set; } // Formato variable

            public ExcelEmpleado(string nombre)
            {
                FullName = nombre;
            }
        }
    }
    
}
