using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using System.Runtime.Intrinsics.Arm;
using System.Reflection.Emit;
using System.Runtime.Serialization;

namespace MicroServicioTracking.Services
{
    public class PayrollCalculationService
    {
        private readonly DbTrackingContext _context;
        private readonly IEmployeesXCheckInsOutsService _employeesxCheckInsOutsServices;
        private readonly ILogger<NormalPayrollService> _logger;
        private readonly IGetBranchesByCompanyService _branchesService;
        private readonly ILoansAndCreditsService _loansAndCreditsService;
        private readonly IConceptsxLoansCreditsService _conceptsxLoansCreditsService;

        //private int payrollId;

        public PayrollCalculationService(
            DbTrackingContext context, 
            IEmployeesXCheckInsOutsService employeesxCheckInsOutsService,
            ILogger<NormalPayrollService> logger,
            IGetBranchesByCompanyService branchesService,
            ILoansAndCreditsService loansAndCreditsService,
            IConceptsxLoansCreditsService conceptsxLoansCreditsService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _employeesxCheckInsOutsServices = employeesxCheckInsOutsService ?? throw new ArgumentNullException(nameof(employeesxCheckInsOutsService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
            _loansAndCreditsService = loansAndCreditsService ?? throw new ArgumentNullException(nameof(loansAndCreditsService));
            _conceptsxLoansCreditsService = conceptsxLoansCreditsService ?? throw new ArgumentNullException(nameof(conceptsxLoansCreditsService));
        }

        public class PayrollRequest
        {
            public DateTime StartDate { get; set; }
            public DateTime EndDate { get; set; }
        }


        // Método para obtener los IDs de empleados desde la tabla EmployeesxChecksInsOuts
        private async Task<List<int>> GetEmployeeIdsFromChecksAsync(DateTime startDate, DateTime endDate, int idBranch)
        {
            return await _context.EmployeesxChecks
                .Where(ec => ec.TimeStamp.Date >= startDate.Date
                            && ec.TimeStamp.Date <= endDate.Date
                            && ec.Active)
                .Join(_context.Employees,
                    ec => ec.IdEmployee,
                    e => e.Id,
                    (ec, e) => new { ec, e })
                .Where(joined => joined.e.IdBranch == idBranch)
                .Select(joined => joined.ec.IdEmployee)
                .Distinct()
                .ToListAsync();
        }

        public async Task<(int payrollId, List<int> employeeIds)> GetDPPayrollAndEmployeeIdsAsync(DateTime startDate, DateTime endDate, int idBranch)
        {

            _logger.LogInformation($"---------------- dentro de getDPpayrollanemployees, stardate es {startDate} y enddate es {endDate} y idBranch es {idBranch}");

            var data = await _context.PayrollRecords
                .Where(pr => pr.StartDate.Date == startDate.Date 
                        && pr.EndDate.Date == endDate.Date 
                        && pr.Active 
                        && pr.IdBranch == idBranch)
                .Select(pr => new
                {
                    pr.PayrollId,
                    EmployeeIds = pr.PayrollEmployees
                        .Join(
                            _context.Employees,
                            pe => pe.EmployeeId,
                            emp => emp.Id,
                            (pe, emp) => new { emp.Id, emp.IdBranch }
                        )
                        .Where(e => e.IdBranch == idBranch) // <- 🔥 Aquí se filtran los empleados por sucursal
                        .Select(e => e.Id)
                        .ToList()
                })
                .FirstOrDefaultAsync();

            // Si no existe ninguna nómina con esas fechas, devolvemos (0, lista vacía)
            if (data == null)
                return (0, new List<int>());

             // Retornamos la tupla con el PayrollId y la lista de IDs de empleados
            _logger.LogInformation($"---------------- dentro de getDPpayrollsasync, payrollId es {data?.PayrollId} y employeeIds es {string.Join(", ", data.EmployeeIds)}");

            return (data.PayrollId, data.EmployeeIds);
        }

        public async Task<NormalPayrollResult> CreateNormalPayrollAsync(DateTime startDate, DateTime endDate, int IdBranch)
        {

            _logger.LogInformation($" --------------------- dentro de createnormalpayrollsasync, startdate es {startDate} y enddate es {endDate} y idbranch es {IdBranch}");

            // Verificamos si hay una nómina con esas fechas en la BD:
            var existsNormalPayroll = await _context.NormalPayrolls
                .AnyAsync(enp => enp.StartDate.Date == startDate.Date && enp.EndDate.Date == endDate.Date && enp.Active && enp.IdBranch == IdBranch);

            _logger.LogInformation($"--------------------------------- existe nomina ya? {existsNormalPayroll}");  
 
            if (existsNormalPayroll) {
                return new NormalPayrollResult(3, $"Ya existe una nómina de esa sucursal en ese período ({startDate.Date} - {endDate.Date})");
            }
            
            // Checamos las incidencias de empleados en las fechas de inicio y final de la semana laboral en la tabla generada por el checador
            // y obtenemos los ids de esos empleados y los agregamos a las tablas de nomina
            // y se crea la nómina normal

            var employeeIdsCheck = await GetEmployeeIdsFromChecksAsync(startDate, endDate, IdBranch);

            _logger.LogInformation($"-----------------------------EmployeeIds desde checkinsouts: " + string.Join(", ", employeeIdsCheck));

            // Se busca si hay una nomina digital con las mismas fechas del periodo laboral, SI NO EXISTE, TERMINA EL PROCESO
            // DEBE HABER UNA NOMINA DIGITAL YA CARGADA PARA CREAR UNA NOMINA NORMAL
            (int payrollId, List<int> employeeIdsDP) = await GetDPPayrollAndEmployeeIdsAsync(startDate, endDate, IdBranch);

            if (payrollId == 0)
            {
                _logger.LogWarning("---------------No hay nóminas digitales que correspondan a este período");
                return new NormalPayrollResult(2, "No hay nóminas digitales que correspondan a este período");
            }
            else
            {
                _logger.LogInformation($"-----------------------------Se encontró la nómina digital con id {payrollId} y los empleados siguientes: ");
                _logger.LogInformation($"-----------------------------EmployeeIds: " + string.Join(", ", employeeIdsDP));
                // Ya tienes el normalPayrollId y la lista employeeCodes  
            }

            var totalDPEarnings = await _context.PayrollEmployees
                .Where(pe => pe.PayrollId == payrollId)
                .Select(pe => new 
                {
                    EmployeeId = pe.EmployeeId,
                    TotalEarnings = pe.TotalEarnings 
                })
                .ToListAsync();

            // aqui une los ids de los empleados encontrados en checkinsouts y en nomina digital
            var totalEmployeesIds = employeeIdsCheck.Union(employeeIdsDP).ToList();

            _logger.LogInformation("-----------------------------Ids checador + ids nomina digital: " + string.Join(", ", totalEmployeesIds));

            // Obtengo información de la tabla de empleados:
            var employeeData = await _context.Employees
                .Where(e => totalEmployeesIds.Contains(e.Id))
                .Select(e => new
                {
                    e.Id,
                    e.Name,
                    e.Vigente,
                    e.PriceXHour,
                    e.BaseHours,
                    e.BaseSalary,
                    e.Loan,
                    e.Saving,
                    e.IdBank,
                    e.Active
                })
                .ToListAsync<object>();

            _logger.LogInformation("-----------------------------Datos del empleado: " + string.Join(", ", employeeData));

            // Obtengo las incidencias de los empleados en la tabla de incidencias de checkinsouts: 
            var incidentsxid = await _employeesxCheckInsOutsServices.IncidentsByEmployee(1, startDate, endDate);

            foreach (var item in incidentsxid)
            {
                _logger.LogInformation($" -- Clave: {item.Key}, Valor: {item.Value}");
            }

            // Crea una nueva nómina normal:
            var normalpayroll = new NormalPayroll
            {
                IdBranch = IdBranch,
                StartDate = startDate,
                EndDate = endDate,
                Active = true
            };

            _logger.LogInformation($"---------------------------- el objeto normalPayroll contiene: {normalpayroll.IdBranch}");

            _context.NormalPayrolls.Add(normalpayroll);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"---------------------------- Nómina creada con ID: {normalpayroll.Id}");

            // Primero crea un diccionario que mapee ID de empleado con sus incidencias
            var allIncidents = new Dictionary<int, Dictionary<string, object>>();

            // Recopila todas las incidencias para cada empleado
            foreach (int employeeId in totalEmployeesIds)
            {
                var employeeIncidents = await _employeesxCheckInsOutsServices.IncidentsByEmployee(employeeId, startDate, endDate);

                 // Visualiza todo el diccionario de incidencias
                _logger.LogInformation($"----------------Incidencias para empleado ID {employeeId}:");
                _logger.LogInformation(JsonSerializer.Serialize(employeeIncidents, new JsonSerializerOptions 
                { 
                    WriteIndented = true 
                }));
                
                // Visualiza cada par clave-valor individualmente
                _logger.LogInformation($"-----------------Desglose de incidencias para empleado ID {employeeId}:");

                foreach (var kvp in employeeIncidents)
                {
                    _logger.LogInformation($"  ------------- Clave: {kvp.Key}, Valor: {kvp.Value}, Tipo: {kvp.Value?.GetType().Name ?? "null"}");
                }

                // Verificar si todos los valores numéricos son cero
                bool allZeros = true;
                
                // Lista de claves a verificar 
                var keysToCheck = new[] { "totalHours", "Hours"};
                
                foreach (var key in keysToCheck)
                {
                    if (employeeIncidents.TryGetValue(key, out var value) && value != null && Convert.ToDouble(value) > 0)
                    {
                        _logger.LogInformation($"---------------- Se encontró valor no cero para {key}: {value}");

                        allZeros = false;
                        break;
                    }
                }
                
                // Solo agregar al diccionario si no todos los valores son ceros
                if (!allZeros)
                {
                    allIncidents[employeeId] = employeeIncidents;
                }
            }

            // checamos el contenido del nuevo diccionario:
            _logger.LogInformation("========== ALL INCIDENTS ==========");
            
            string jsonString = JsonSerializer.Serialize(allIncidents, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            });

            _logger.LogInformation($"-----------------Todos los incidencias: {jsonString}");
            _logger.LogInformation("==================================");

            // Convertimos los datos que vienen de la tabla empleados (employeedata) en un diccionario para relacionar estos datos con la lista de
            // para realizar calculos:

            // Primero convierte employeeData a un diccionario para acceso rápido por ID
            var employeeDataDict = new Dictionary<int, dynamic>();

            foreach (dynamic employee in employeeData)
            {
                employeeDataDict[employee.Id] = employee;
            }

            var totalEarningsxEmployeeDict = new Dictionary<int, dynamic>();

            foreach (dynamic earning in totalDPEarnings) {
                totalEarningsxEmployeeDict[earning.EmployeeId] = earning;
            }

            // Ahora crea la lista de EmployeesByPayroll usando la información de incidencias
            var employeesList = totalEmployeesIds.Select(id => 
            {
                // Verifica si tenemos incidencias para este empleado
                bool hasIncidents = allIncidents.TryGetValue(id, out var incidents);

                Console.WriteLine($" ---CREANDO NUEVO EMPLOYEESXPAYROLL: ID {id} INCIDENTES bool {hasIncidents} incidentes {JsonSerializer.Serialize(incidents, new JsonSerializerOptions { WriteIndented = true })}");

                // Intenta obtener los datos del empleado del diccionario
                bool hasEmployeeData = employeeDataDict.TryGetValue(id, out var empData);

                bool hasTotalEarningData = totalEarningsxEmployeeDict.TryGetValue(id, out var earningData);
                Console.WriteLine($" ---CREANDO NUEVO EMPLOYEESXPAYROLL: ID {id} totalearnings bool {hasTotalEarningData} ");

                // Valores predeterminados o calculados según las incidencias
                decimal workedHours = hasIncidents && incidents != null && incidents.TryGetValue("Hours", out var hours) ? Convert.ToDecimal(hours) : 0.0M;

                // Obtén el precio por hora del empleado si está disponible
                decimal priceXHour = hasEmployeeData && empData.PriceXHour != null ? Convert.ToDecimal(empData.PriceXHour) : 0.0M;

                decimal baseHours = hasEmployeeData && empData.BaseHours != null ? Convert.ToDecimal(empData.BaseHours) : 0.0M;

                // Calcula el salario base según las horas trabajadas y el precio por hora
                decimal baseSalary = workedHours * priceXHour;
                decimal extraworkedhours = (workedHours - baseHours) > 0 ? (workedHours - baseHours) : 0M;
                decimal grossSalary = baseSalary + (extraworkedhours * priceXHour * 1.5M);
    
                // Obtén otros valores del empleado
                decimal savings = hasEmployeeData && empData.Saving != null ? Convert.ToDecimal(empData.Saving) : 0.0M;
                decimal absences = hasIncidents && incidents.TryGetValue("Absences", out var absenceValue) ? Convert.ToDecimal(absenceValue) : 0.0M;
                decimal delays = hasIncidents && incidents.TryGetValue("Delays", out var delayValue) ? Convert.ToDecimal(delayValue) : 0.0M;
                decimal loan = hasEmployeeData && empData.Loan != null ? Convert.ToDecimal(empData.Loan) : 0.0M;

                decimal digitalpayment = hasTotalEarningData && earningData.TotalEarnings != null ? Convert.ToDecimal(earningData.TotalEarnings) : 0.0M;
                
                return new EmployeesByPayroll
                {
                    Id_employee = id,
                    Id_normalpayroll = normalpayroll.Id,
                    PriceXHour = priceXHour,
                    WorkedHours = workedHours,
                    ExtraWorkedHours = extraworkedhours, 
                    BaseSalary = baseSalary,
                    ExtraSalary = extraworkedhours * priceXHour * 1.5M,                    
                    Bonus = hasEmployeeData ? (decimal)(empData.BaseHours > 0 ? empData.BaseHours * 0.1M : 10.0M) : 0.0M,
                    GrossSalary = grossSalary,
                    //PercentageDiscount = parameters.Discount ? (decimal) 25.0M : Convert.ToDecimal(parameters.Discount),
                    realDiscount = 0.0M, //(hasIncidents && incidents.TryGetValue("DiscountHours", out var discountHours) ? Convert.ToDecimal(discountHours) * priceXHour : 0M) + loan,
                    DigitalPayment = digitalpayment,
                    Savings = savings,
                    Absences = absences,
                    Delays = delays,
                    Total = 0.0M, // Puedes recalcular esto al final con los valores reales
                    Active = true
                };
            }).ToList();

            // Aquí puedes guardar los totales en la nómina normal
            //var CalculatePayrollResult = await CalculateNormalPayrollXEmployee(normalpayroll.Id, employeesList, IdBranch);

            if (employeesList != null)
            {
                await CalculateNormalPayrollXEmployee(normalpayroll.Id, employeesList, startDate, endDate, IdBranch, null);

                foreach (var dato in employeesList) {
                    _logger.LogInformation($"--------------- DESPUES DE CALCULATE quedan estos DATOS: {JsonSerializer.Serialize(dato, new JsonSerializerOptions { WriteIndented = true })}");
                }

                _context.EmployeesByPayroll.AddRange(employeesList);
                await _context.SaveChangesAsync();
            }

            var totales = await _context.EmployeesByPayroll
                .Where(e => e.Id_normalpayroll == normalpayroll.Id)
                .GroupBy(e => e.Id_normalpayroll)
                .Select(g => new
                {
                    TotalBaseWorkHours = g.Sum(e => (decimal?)e.WorkedHours ?? 0),
                    TotalBaseExtra = g.Sum(e => (decimal?)e.ExtraSalary ?? 0),
                    TotalSubtotal = g.Sum(e => ((decimal?)e.BaseSalary ?? 0) + ((decimal?)e.ExtraSalary ?? 0)),
                    TotalDescuentos = g.Sum(e => (decimal?)e.realDiscount ?? 0),
                    TotalBonos = g.Sum(e => (decimal?)e.Bonus ?? 0),
                    Total = g.Sum(e => (
                                (decimal?)e.BaseSalary ?? 0) +
                                ((decimal?)e.ExtraSalary ?? 0) +
                                ((decimal?)e.Bonus ?? 0) -
                                ((decimal?)e.realDiscount ?? 0) -
                                ((decimal?)e.DigitalPayment ?? 0)
                            )
                })
                .FirstOrDefaultAsync();


            // aqui calcula la nomina completa, totales de todos los empleados
            _logger.LogInformation("--------------- Totales calculados: " + JsonSerializer.Serialize(totales, new JsonSerializerOptions { WriteIndented = true }));

            if (totales != null)
            {
                var normalPayroll2 = await _context.NormalPayrolls.FirstOrDefaultAsync(n => n.Id == normalpayroll.Id);
                if (normalPayroll2 != null)
                {
                    normalPayroll2.TotalBaseWorkingHours = totales.TotalBaseWorkHours;
                    normalPayroll2.TotalBaseExtraHours = totales.TotalBaseExtra;
                    normalPayroll2.TotalSubtotal = totales.TotalSubtotal;
                    normalPayroll2.TotalBonos = totales.TotalBonos;
                    normalPayroll2.TotalDescuentos = totales.TotalDescuentos;

                    normalPayroll2.Total = totales.Total;

                    await _context.SaveChangesAsync();
                }
            }

            _logger.LogInformation("===== CONTENIDO DE totalEarningsxEmployeeDict =====");
            _logger.LogInformation(JsonSerializer.Serialize(totalEarningsxEmployeeDict, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            }));
            _logger.LogInformation("===================================================");

            _logger.LogInformation($"===== CONTENIDO DE totalDPEarnings ===== para la payrollid = {payrollId}");
            _logger.LogInformation(JsonSerializer.Serialize(totalDPEarnings, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            }));
            _logger.LogInformation("=======================================");

            return new NormalPayrollResult(5, $"Entrada en nomina y empleados exitosa!");
        }

        // Método para calcular la suma de los bonos de un empleado
        private async Task<decimal> CalculateBonusXEmployee(int idEmployee, DateTime startDate, DateTime endDate, int idBranch)
        {
            var totalBonus = await _context.EmployeeBonusValues
                .Where(v => v.IdEmployee == idEmployee && v.IdBranch == idBranch && v.IncidenceDate.Date >= startDate.Date && v.IncidenceDate.Date <= endDate.Date)
                .SumAsync(v => (decimal?)v.ValueAddition);

            return totalBonus ?? 0.0M;
        }

        // Sobrecarga para un solo empleado
        public async Task CalculateNormalPayrollXEmployee(int normalPayrollId, int idEmployee, DateTime startDate, DateTime endDate, int idBranch, PayrollData? items)
        {
            // Construimos la lista con un único elemento
            var single = new EmployeesByPayroll { Id_employee = idEmployee };
            await CalculateNormalPayrollXEmployee(normalPayrollId, new List<EmployeesByPayroll> { single }, startDate, endDate, idBranch, items);
        }

        // Método principal que trabaja siempre con lista
        public async Task CalculateNormalPayrollXEmployee(int NormalPayrollId, List<EmployeesByPayroll> EmployeesList, DateTime startDate, DateTime endDate, int IdBranch, PayrollData? items)
        {
            // aqui verifico si es una llamada de modificación de descuento en la nomina del empleado
            if (items == null)
            { }
            else
            {
                _logger.LogInformation($"----------------- Modificando nómina normal con ID {NormalPayrollId} para el empleado {EmployeesList[0].Id_employee} con descuento {items.discount} y bono {items.bonus}");
                
                var employeeId = EmployeesList[0].Id_employee;

                if (items.discount > 0.0M)
                {
                    _logger.LogInformation($"----------------- Aplicando descuento de {items.discount} al empleado {employeeId}");
                }
                else
                {
                    _logger.LogInformation($"----------------- No se aplica descuento al empleado {employeeId}");
                    return;
                }

                try
                {

                    var payrollEmployee = await _context.EmployeesByPayroll
                        .FirstOrDefaultAsync(p => p.Id_normalpayroll == NormalPayrollId && p.Id_employee == employeeId && p.Active == true);

                    _logger.LogInformation($"----------------- Datos del empleado a modificar: {payrollEmployee.DigitalPayment} ");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error al buscar el empleado con ID {EmployeeId} en la nómina normal con ID {NormalPayrollId} error: {ex.Message}", employeeId, NormalPayrollId, ex.Message);
                    return; // Retorna si no se encuentra el empleado
                }

                    // Aquí se actualizan los valores del empleado
                  /*   var employee = EmployeesList[0];
                    employee.realDiscount = items.discount ?? 0.0M;
                    employee.Bonus = items.bonus ?? 0.0M;
                    employee.Total = employee.BaseSalary + employee.ExtraSalary + employee.Bonus - employee.realDiscount - employee.DigitalPayment;

                    _logger.LogInformation($"----------------- Empleado modificado: {JsonSerializer.Serialize(employee, new JsonSerializerOptions { WriteIndented = true })}"); */

                    // Aquí puedes guardar los cambios en la base de datos si es necesario
                    // await _context.SaveChangesAsync();


                //employee.Bonus = items.bonus ?? 0.0M;
                //employee.realDiscount = items.discount ?? 0.0M;
                //employee.Total = employee.BaseSalary + employee.ExtraSalary + employee.Bonus - employee.realDiscount - employee.DigitalPayment;
                    return; // Retorna si solo se modifica un empleado
            }

            try
            {
                // Aquí puedes implementar la lógica para calcular la nómina normal por empleado
                // utilizando el normalPayrollId proporcionado.
                // Por ejemplo, podrías buscar la nómina en la base de datos y realizar cálculos.

                _logger.LogInformation($"----------------- Calculando nómina normal con ID {NormalPayrollId} para {EmployeesList.Count} empleados.");

                foreach (var employee in EmployeesList)
                {
                    _logger.LogInformation($"----------------- CALCULATE Dato a guardar en employeexpayroll: {JsonSerializer.Serialize(employee, new JsonSerializerOptions { WriteIndented = true })}");

                    // Aquí se calculan los bonos, se busca en la tabla de employeesxbonus para ver si hay registros de bonos por cada empleado:

                    var totalBonus = await CalculateBonusXEmployee(employee.Id_employee, startDate, endDate, IdBranch);

                    employee.Bonus = totalBonus;

                    _logger.LogInformation($"----------------- Total de bonos para el empleado {employee.Id_employee}: {employee.Bonus}");

                    // Salario Bruto
                    employee.GrossSalary = employee.BaseSalary + employee.ExtraSalary + employee.Bonus;

                    // Aquí se checan los ahorros
                    var resultadoAhorros = await _context.Loanandcredits
                    .Where(l => l.IdEmpleado == employee.Id_employee
                                && l.Date >= startDate.Date
                                && l.Date <= endDate.Date
                                && l.Type == "AHORRO"
                                && l.Active == true)
                    .Select(l => new { l.Monto, l.Payments })
                    .ToListAsync();

                    if (resultadoAhorros.Count > 0)
                        employee.Savings = resultadoAhorros.Sum(l => (l.Monto ?? 0) - (l.Payments ?? 0));
                    else
                        employee.Savings = 0.0M;

                    _logger.LogInformation($"------------------- [NÓMINA] Ahorros: {employee.Savings}");

                    var loanResults = await _loansAndCreditsService.LoansByEmployee(employee.Id_employee, "PRESTAMO");

                    loanResults = loanResults
                        .OrderBy(l => l.Date)
                        .ToList();

                    if (loanResults.Count > 0)
                    {
                        foreach (var loan in loanResults)
                        {
                            _logger.LogInformation($"----------------- [NÓMINA] Prestamo: {loan.Id} | Monto: {loan.Monto} | Pagos: {loan.Payments} | Remanente: {loan.Remain} | Fecha: {loan.Date} | Tipo: {loan.Type}");
                        }

                        var totalMontos = loanResults.Sum(k => k.Monto ?? 0);                                   //resultadoPrestamos.Sum(l => l.Monto ?? 0);
                        var totalPayments = loanResults.Sum(l => l.Payments ?? 0);                              //resultadoPrestamos.Sum(l => l.Payments ?? 0);
                        var deudaPrestamos = totalMontos - totalPayments;

                        _logger.LogInformation($"----------------- Total de prestamos para el empleado {employee.Id_employee}: Total en préstamos: {totalMontos} -- " +
                            $"Total en Pagos: {totalPayments} -- Remanente: {deudaPrestamos}");

                        // obtiene los parámetros del setup de la nómina
                        var parameters = await _context.HRManagement
                            .FirstOrDefaultAsync(np => np.IdBranch == IdBranch && np.Active);

                        _logger.LogInformation($"----------------- El empleado {employee.Id_employee} tiene un porcentaje de descuento de {parameters.Discount}% y si se aplica tendría ${deudaPrestamos * (parameters.Discount / 100)} descontado!");

                        var percentageDiscount = parameters.Discount / 100;

                        // el descuento se calcula con el salario bruto y el porcentaje de descuento
                        var discount = employee.GrossSalary * percentageDiscount;

                        employee.realDiscount = (decimal)discount;

                        _logger.LogInformation($"----------------- Total de prestamos para el empleado {employee.Id_employee} quedaría: {deudaPrestamos} y su descuento quedaría en {discount}");

                        // Aquí se actualiza el descuento en la tabla de loansandcredits
                        var appliedPayments = ApplyLoanPayment(loanResults, (decimal)discount);

                        foreach (var payment in appliedPayments)
                        {
                            // Aquí se aplica el pago a los préstamos
                            await _conceptsxLoansCreditsService.Save(payment);
                            _logger.LogInformation($"----------------- Pago aplicado a préstamo ID {payment.IdLoanAndCredit} por ${payment.Total} el {payment.Date:yyyy-MM-dd}");
                        }
                    }

                    employee.Total = employee.BaseSalary + employee.ExtraSalary + employee.Bonus - employee.realDiscount - employee.DigitalPayment;

                    _logger.LogInformation($"-----------------Empleado {employee.Id_employee} calculado correctamente. Total: {employee.Total}");
                    
                    //return; // Retorna true si el cálculo fue exitoso
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al calcular la nómina normal con ID {NormalPayrollId}", NormalPayrollId);
                //return; // Retorna false si hubo un error
            }
        }

        public async Task<bool> TestConnection()
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
        }


        public List<ConceptsxLoansCredit> ApplyLoanPayment(List<Loanandcredit> loans, decimal paymentAmount)
        {
            // Implementación de la lógica para aplicar el pago a los préstamos
            if (paymentAmount <= 0)
            {
                _logger.LogWarning("------------------ PAGOS A PRESTAMOS: El monto del pago debe ser mayor que cero.");
                return new List<ConceptsxLoansCredit>();
            }

            decimal totalRemaining = loans.Sum(l => l.Remain ?? 0);

            if (paymentAmount > totalRemaining)
            {
                _logger.LogWarning("----------------- PAGOS A PRESTAMOS: El monto del pago es mayor que el total restante de los préstamos.");
                return new List<ConceptsxLoansCredit>();
            }

            // ordenamos los préstamos por fecha de creación
            var orderedLoans = loans.OrderBy(l => l.Date).ToList();

            var movements = new List<ConceptsxLoansCredit>();

            foreach (var loan in orderedLoans)
            {
                if (paymentAmount <= 0)
                {
                    break; // Si ya no hay monto para pagar, salimos del bucle
                }

                decimal applied = 0;

                if (loan.Remain.HasValue && loan.Remain >= paymentAmount)
                {
                    applied = paymentAmount;
                    paymentAmount = 0; // Todo el pago se aplica a este préstamo
                }
                else
                {
                    applied = loan.Remain ?? 0; // Aplicamos lo que queda del préstamo
                    paymentAmount -= applied; // Restamos lo aplicado del monto total del pago
                }

                movements.Add(new ConceptsxLoansCredit
                {
                    IdLoanAndCredit = loan.Id,
                    Date = DateTime.Now,
                    Total = applied,
                    Status = "APLICADO",
                    Comments = $"Pago aplicado de ${applied} a préstamo ID {loan.Id} desde cálculo de nómina",
                    Active = true
                });

            }

            return movements;
        }

        // ----------------------------------------------------------------------------------------

       

        private async Task<NormalPayrollResult> PayrollRecalculate(int payrollId) 
        {
            try 
            {
                var payroll = await _context.NormalPayrolls
                    .Where(p => p.Id == payrollId)
                    .FirstOrDefaultAsync();

                if (payroll.Id > 0) 
                {
                    var listaEmpleados = await _context.EmployeesByPayroll
                        .Where(ep => ep.Id_normalpayroll == payrollId && ep.Active == true)
                        .Select(ep => ep.Id_employee)
                        .Distinct()
                        .ToListAsync();

                    if (listaEmpleados.Count > 0)
                    {
                        var start = payroll.StartDate.Date;
                        var end = payroll.EndDate.Date;

                        foreach(var emp in listaEmpleados) 
                        {
                            var totalBonos = await _context.EmployeeBonusValues
                                .Where(eb => eb.IdEmployee == emp 
                                    && eb.IdBranch == payroll.IdBranch
                                    && eb.IncidenceDate >= start
                                    && eb.IncidenceDate <= end)
                            .SumAsync(eb => eb.ValueAddition);

                            await _context.EmployeesByPayroll
                                .Where(exp => exp.Id_employee == emp && exp.Id_normalpayroll == payrollId && exp.Active == true)
                                .ExecuteUpdateAsync(setters => setters
                                    .SetProperty(exp => exp.Bonus, totalBonos)
                                    .SetProperty(exp => exp.GrossSalary, exp => exp.BaseSalary + exp.ExtraSalary + totalBonos)
                                    .SetProperty(exp => exp.realDiscount, exp => exp.realDiscount) 
                                    .SetProperty(exp => exp.Total, exp => exp.BaseSalary + exp.ExtraSalary + totalBonos - exp.realDiscount));
                        }
                    }    

                    var calculation = await _context.EmployeesByPayroll
                        .Where(e => e.Id_normalpayroll == payrollId)
                        .GroupBy(e => e.Id_normalpayroll)
                        .Select(g => new
                        {
                            TotalWorkedHours = g.Sum(e => e.WorkedHours),
                            TotalExtraWorkedHours = g.Sum(e => e.ExtraWorkedHours),
                            TotalBaseSalary = g.Sum(e => e.BaseSalary),
                            TotalExtraSalary = g.Sum(e => e.ExtraSalary),
                            TotalBonus = g.Sum(e => e.Bonus),
                            TotalGrossSalary = g.Sum(e => e.GrossSalary),
                            TotalRealDiscount = g.Sum(e => e.realDiscount),
                            TotalDigitalPayment = g.Sum(e => e.DigitalPayment),
                            TotalSavings = g.Sum(e => e.Savings),
                            TotalAbsences = g.Sum(e => e.Absences),
                            TotalDelays = g.Sum(e => e.Delays),
                            TotalPayroll = g.Sum(e => e.Total)
                        })
                        .FirstOrDefaultAsync();    

                    _logger.LogInformation($"------------------- RECALCULATE: Estos son los resultados de las sumas: Workedhrs: {calculation.TotalWorkedHours} BaseSalary {calculation.TotalBaseSalary} Bonus {calculation.TotalBonus} GrossSalary {calculation.TotalGrossSalary} Realdiscount {calculation.TotalRealDiscount} DigitalP {calculation.TotalDigitalPayment} Total {calculation.TotalPayroll}");

                    await _context.NormalPayrolls
                        .Where(np => np.Id == payrollId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(np => np.TotalBaseWorkingHours, calculation.TotalWorkedHours)
                            .SetProperty(np => np.TotalBaseExtraHours, calculation.TotalExtraWorkedHours)
                            .SetProperty(np => np.TotalBonos, calculation.TotalBonus)
                            .SetProperty(np => np.TotalSubtotal, calculation.TotalGrossSalary)
                            .SetProperty(np => np.TotalDescuentos, calculation.TotalRealDiscount)
                            .SetProperty(np => np.Total, calculation.TotalBaseSalary + calculation.TotalExtraSalary + calculation.TotalBonus - calculation.TotalRealDiscount)
                            );
                }
                return new NormalPayrollResult(7, $"No existe una nómina para recalcular {payrollId}");
            }
            catch (Exception ex)
            {
                return new NormalPayrollResult(8, $"Error al eliminar y actualizar: {ex.Message}");
            }
        }
    }
}