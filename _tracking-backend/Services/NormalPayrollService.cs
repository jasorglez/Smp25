using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;
using MicroServicioTracking.Models.View;

namespace MicroServicioTracking.Services
{
    public class NormalPayrollService
    {
        private readonly DbTrackingContext _context;
        private readonly IEmployeesXClockService _employeesxClockService;
        private readonly IEmployeesXCheckInsOutsService _employeesxCheckInsOutsServices;
        private readonly IConceptsxLoansCreditsService _service;
        private readonly ISpecialExtraHoursService _specialExtraHoursService;       
        private readonly ILogger<NormalPayrollService> _logger;
        private readonly IGetBranchesByCompanyService _branchesService;
        private readonly PayrollService _payrollService;
        private readonly ILoansAndCreditsService _loansAndCreditsService;
        private readonly IConceptsxLoansCreditsService _conceptsxLoansCreditsService;

        //private int payrollId;

        public NormalPayrollService(
            DbTrackingContext context, 
            IEmployeesXCheckInsOutsService employeesxCheckInsOutsService,
            ISpecialExtraHoursService specialExtraHoursService,
            IEmployeesXClockService employeesxClockService,
            ILogger<NormalPayrollService> logger,
            IGetBranchesByCompanyService branchesService,
            ILoansAndCreditsService loansAndCreditsService,
            IConceptsxLoansCreditsService conceptsxLoansCreditsService,
            PayrollService payrollService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _employeesxClockService = employeesxClockService ?? throw new ArgumentNullException(nameof(employeesxClockService));
            _payrollService = payrollService ?? throw new ArgumentNullException(nameof(payrollService));
            _employeesxCheckInsOutsServices = employeesxCheckInsOutsService ?? throw new ArgumentNullException(nameof(employeesxCheckInsOutsService));
            _specialExtraHoursService = specialExtraHoursService ?? throw new ArgumentNullException(nameof(specialExtraHoursService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
            _loansAndCreditsService = loansAndCreditsService ?? throw new ArgumentNullException(nameof(loansAndCreditsService));
            _conceptsxLoansCreditsService = conceptsxLoansCreditsService ?? throw new ArgumentNullException(nameof(conceptsxLoansCreditsService));
        }

        public async Task<List<EmployeesByBonusDTO>> GetAllAsync(int idBranch, DateTime startDate, DateTime endDate)
        {

            List<EmployeesByBonusDTO> queryResult = new List<EmployeesByBonusDTO>();
            List<ActiveBranchIds> branches = new List<ActiveBranchIds>();

            if (idBranch < 0) 
                branches = await _context.Set<ActiveBranchIds>().Where(x => x.idCompany == -idBranch).ToListAsync();

            // Serializa la lista de branches a JSON para una mejor visualización en los registros
            string branchesJson = JsonSerializer.Serialize(branches, new JsonSerializerOptions { WriteIndented = true });

            _logger.LogInformation($"--------------------- dentro de getallasync, idbranch es {idBranch} y branches es {branchesJson}");

            if (idBranch > 0) {
                queryResult = await _context.EmployeesxBonus
                    .Where(b => b.Active == true)
                    .Where(b => b.IncidenceDate >= startDate)
                    .Where(b => b.IncidenceDate <= endDate)
                    .Where(b => b.IdBranch == idBranch)
                    .Select(b => new EmployeesByBonusDTO
                    {
                        Id = b.Id,
                        IdBranch = b.IdBranch ?? 0,
                        IdEmployee = b.IdEmployee ?? 0,
                        IdBonus = b.IdBonus ?? 0,
                        EmployeeName = b.EmployeeName,
                        IncidenceDate = b.IncidenceDate,
                        //Bonus = b.Bonus,
                        //Quantity = b.Quantity,
                        Vigente = b.Vigente ?? true,
                        Active = b.Active
                    })
                    .OrderByDescending(b => b.IncidenceDate)
                    .ThenBy(e => e.IdEmployee)
                    .ToListAsync();  
            }
            else {
                var branchIds = branches[0].BranchIds
                    .Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(id => int.Parse(id.Trim()))
                    .ToList();

                foreach (var b in branchIds) {
                    _logger.LogInformation($"------------------------ BranchId: {b}");
                }

                queryResult = await _context.EmployeesxBonus
                    .Where(b => b.Active == true)
                    .Where(b => b.IncidenceDate >= startDate)
                    .Where(b => b.IncidenceDate <= endDate)
                    .Where(b => b.IdBranch.HasValue && branchIds.Contains(b.IdBranch.Value))
                    .Select(b => new EmployeesByBonusDTO
                    {
                        Id = b.Id,
                        IdBranch = b.IdBranch ?? 0,
                        IdEmployee = b.IdEmployee ?? 0,
                        IdBonus = b.IdBonus ?? 0,
                        EmployeeName = b.EmployeeName,
                        IncidenceDate = b.IncidenceDate,
                        //Bonus = b.Bonus,
                        //Quantity = b.Quantity,
                        Vigente = b.Vigente ?? true,
                        Active = b.Active
                    })
                    .OrderByDescending(b => b.IncidenceDate)
                    .ThenBy(e => e.IdEmployee)
                    .ToListAsync(); 
            }

            if (queryResult.Count > 0)
            {
                foreach (var q in queryResult)
                {
                    _logger.LogInformation($"------------ Id {q.Id} | Empleado: {q.EmployeeName} | Fecha: {q.IncidenceDate:yyyy-MM-dd} | IdEmpleado: {q.IdEmployee} | Sucursal: {q.IdBranch} | IdBonus: {q.IdBonus}");
                }
            }

            // Unimos ambas listas
            var finalList = new List<EmployeesByBonusDTO>();
            if (queryResult != null)
                finalList.AddRange(queryResult);
            //if (check != null)
            //    finalList.AddRange(check);

            foreach (var item in finalList)
            {
                _logger.LogInformation($" --- Id: {item.Id} | Empleado: {item.IdEmployee} | Nombre: {item.EmployeeName} | Sucursal: {item.IdBranch} | Fecha: {item.IncidenceDate:yyyy-MM-dd} | IdBono: {item.IdBonus} | Vigente: {item.Vigente}");
            }

            return finalList;    
        }

        public async Task<bool> UpdateSavingEmployeePayroll(int id, decimal monto)
        {
            try
            {
                var entity = await _context.EmployeesByPayroll.FirstOrDefaultAsync(e => e.Id == id);

                if (entity == null)
                    return false;
                
                entity.Savings = monto;
                entity.Total = entity.GrossSalary - entity.Savings -entity.DigitalPayment - entity.realDiscount;
                await _context.SaveChangesAsync();
                var calculation = await _context.EmployeesByPayroll
                        .Where(e => e.Id_normalpayroll == entity.Id_normalpayroll)
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

                    _logger.LogInformation($"------------------- RECALCULATE: Estos son los resultados de las sumas: Workedhrs: {calculation.TotalWorkedHours} BaseSalary {calculation.TotalBaseSalary} Bonus {calculation.TotalBonus} GrossSalary {calculation.TotalGrossSalary} Realdiscount {calculation.TotalRealDiscount} DigitalP {calculation.TotalDigitalPayment} Total {calculation.TotalPayroll} digitalP {calculation.TotalDigitalPayment}");

                    await _context.NormalPayrolls
                        .Where(np => np.Id == entity.Id_normalpayroll)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(np => np.TotalBaseWorkingHours, calculation.TotalWorkedHours)
                            .SetProperty(np => np.TotalBaseExtraHours, calculation.TotalExtraWorkedHours)
                            .SetProperty(np => np.TotalBonos, calculation.TotalBonus)
                            .SetProperty(np => np.TotalSubtotal, calculation.TotalGrossSalary)
                            .SetProperty(np => np.TotalSavings, calculation.TotalSavings)
                            .SetProperty(np => np.TotalDescuentos, calculation.TotalRealDiscount)
                            .SetProperty(np => np.Total, calculation.TotalPayroll)
                            );
                //await PayrollRecalculate(entity.Id_normalpayroll);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating savings for employee payroll ID {Id}", id);
                return false;
            }
        }
        public async Task<bool> UpdateRealDiscountEmployeePayroll(int id, decimal monto)
        {
            try
            {
                var entity = await _context.EmployeesByPayroll.FirstOrDefaultAsync(e => e.Id == id);

                if (entity == null)
                    return false;

                entity.realDiscount = monto;
                entity.Total = entity.GrossSalary - entity.Savings -entity.DigitalPayment - entity.realDiscount;
                await _context.SaveChangesAsync();
                var calculation = await _context.EmployeesByPayroll
                        .Where(e => e.Id_normalpayroll == entity.Id_normalpayroll)
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

                    _logger.LogInformation($"------------------- RECALCULATE: Estos son los resultados de las sumas: Workedhrs: {calculation.TotalWorkedHours} BaseSalary {calculation.TotalBaseSalary} Bonus {calculation.TotalBonus} GrossSalary {calculation.TotalGrossSalary} Realdiscount {calculation.TotalRealDiscount} DigitalP {calculation.TotalDigitalPayment} Total {calculation.TotalPayroll} digitalP {calculation.TotalDigitalPayment}");

                    await _context.NormalPayrolls
                        .Where(np => np.Id == entity.Id_normalpayroll)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(np => np.TotalBaseWorkingHours, calculation.TotalWorkedHours)
                            .SetProperty(np => np.TotalBaseExtraHours, calculation.TotalExtraWorkedHours)
                            .SetProperty(np => np.TotalBonos, calculation.TotalBonus)
                            .SetProperty(np => np.TotalSubtotal, calculation.TotalGrossSalary)
                            .SetProperty(np => np.TotalDescuentos, calculation.TotalRealDiscount)
                            .SetProperty(np => np.Total, calculation.TotalPayroll)
                            );
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating savings for employee payroll ID {Id}", id);
                return false;
            }
        }

        
        public async Task<List<EmployeesxBonus>> SaveBonusesAsync(List<EmployeesByBonusDTO> bonuses)
        {

            foreach (var b in bonuses)
            {
                _logger.LogInformation($"---------- SAVEBONUSES: ----------------- Empleado: {b.IdEmployee} | Nombre: {b.EmployeeName} | Sucursal: {b.IdBranch} | Fecha: {b.IncidenceDate:yyyy-MM-dd} | IdBonus: {b.IdBonus} | Vigente: {b.Vigente} | Activo: {b.Active}");
            }

            var entities = bonuses.Select(b => new EmployeesxBonus
            {
                IdBranch = b.IdBranch,
                IdEmployee = b.IdEmployee,
                IdBonus = b.IdBonus,
                FromPayroll = b.FromPayroll,
                EmployeeName = b.EmployeeName,
                IncidenceDate = b.IncidenceDate,
                Vigente = b.Vigente,
                Active = b.Active
            }).ToList();

            await _context.EmployeesxBonus.AddRangeAsync(entities);
            await _context.SaveChangesAsync();

            foreach (var b in entities)
            {
                var idNormalPayroll = await _context.NormalPayrolls
                       .Where(np => b.IncidenceDate.Date >= np.StartDate.Date &&
                           b.IncidenceDate.Date <= np.EndDate.Date &&
                           np.IdBranch == b.IdBranch &&
                           np.Active == true)
                       .Select(np => np.Id)
                       .FirstOrDefaultAsync();

                await PayrollRecalculate(idNormalPayroll);
            }
            return entities;
        }
        
        public async Task<EmployeesByBonusDTO?> AddBonus(int IdBranch, int IdEmployee, DateTime date, string Bono, decimal Cantidad)
        {
            var rawResult = await _employeesxCheckInsOutsServices.ChecksByBranch(IdBranch, date, date);

            var check = rawResult
                .Cast<dynamic>()
                .Select(x => new EmployeesByBonusDTO
                {
                    Id = x.Id,
                    IdEmployee = x.idEmployee,
                    EmployeeName = x.Name,
                    IdBranch = x.IdBranch,
                    IdBonus = x.IdBonus,
                    IncidenceDate = x.TimeStamp,
                    Valid = x.Valid,
                    //Bonus = Bono // 👈 Se lo asignamos directamente
                })
                .Where(x => x.Valid && x.IdEmployee == IdEmployee)
                .GroupBy(x => x.IncidenceDate.Date)
                .Select(g => g.First()) // o .Last() si prefieres el último del día
                .FirstOrDefault();

            if (check != null)
            {
                _logger.LogInformation($"---------- ADDBONUSES --------- Empleado: {check.IdEmployee} | Nombre: {check.EmployeeName} | Sucursal: {check.IdBranch} | Fecha: {check.IncidenceDate:yyyy-MM-dd} | IdBonus: {check.IdBonus}");
            }

            // 👇 Insertar en employeesxbonus
            var bonus = new EmployeesxBonus
            {
                IdEmployee = check.IdEmployee,
                IncidenceDate = check.IncidenceDate.Date,
                IdBonus = check.IdBonus,
                //Bonus = check.Bonus,
                //Quantity = Cantidad, // Aquí puedes ajustar si necesitas otro valor
                Vigente = true, // O DateTime si aplica
                Active = true
            };

            _context.EmployeesxBonus.Add(bonus);
            await _context.SaveChangesAsync();

            //Console.WriteLine($"BONUS guardado para {check.EmployeeName} el {check.IncidenceDate:yyyy-MM-dd}");
            _logger.LogInformation($"----------- ADDBONUSES --------------- BONUS guardado para {check.EmployeeName} el {check.IncidenceDate:yyyy-MM-dd}");

            return check;
        }

        public async Task<(byte[] FileContent, string FileName, string ContentType)?> GetPayrollExcelFile(int idBranch, DateTime startDate, DateTime endDate)
        {
            try
            {
                // Verificar si el registro existe en normalPayroll
                var payroll = await _context.PayrollRecords
                    .FirstOrDefaultAsync(p => p.IdBranch == idBranch && p.StartDate.Date == startDate.Date && p.EndDate.Date == endDate.Date && p.Active == true);

                if (payroll == null || payroll.ExcelFile == null)
                {
                    _logger.LogWarning("......... Archivo de nómina no encontrado. IdBranch: {IdBranch}, StartDate: {StartDate}, EndDate: {EndDate}", 
                        idBranch, startDate, endDate);
                    return null;
                }

                // Generar nombre de archivo descriptivo
                string fileName = $"Nomina_{startDate:ddMMyyyy}_{endDate:ddMMyyyy}.xlsx";
                string contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

                return (payroll.ExcelFile, fileName, contentType);
            }
            catch (Exception ex)
            {
                 _logger.LogError(ex, "Error al obtener el archivo Excel de nómina. IdBranch: {IdBranch}, StartDate: {StartDate}, EndDate: {EndDate}", 
                    idBranch, startDate, endDate);
                throw; // Re-lanzar la excepción para que el controlador la maneje
            }
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

        public async Task<List<int>> GetPayrollEmployeeIdsByBranchAsync(int payrollId, int branchId)
{
    var data = await _context.PayrollRecords
        .Where(pr => pr.PayrollId == payrollId && pr.Active && pr.IdBranch == branchId)
        .Select(pr => new
        {
            EmployeeIds = pr.PayrollEmployees
                .Join(
                    _context.Employees,
                    pe => pe.EmployeeId,
                    emp => emp.Id,
                    (pe, emp) => new { emp.Id, emp.IdBranch }
                )
                .Where(e => e.IdBranch == branchId)
                .Select(e => e.Id)
                .ToList()
        })
        .FirstOrDefaultAsync();

    var employeeIds = data?.EmployeeIds ?? new List<int>();

    _logger.LogInformation($"[GetPayrollEmployeeIdsByBranchAsync] PayrollId: {payrollId}, BranchId: {branchId}, EmployeeIds: {string.Join(", ", employeeIds)}");

    return employeeIds;
        }


        public async Task<NormalPayrollResult> CreateNormalPayrollAsync(DateTime startDate, DateTime endDate, int IdBranch, bool closed, int idBlockPeriod, int PayrollId)
        {

            //_logger.LogInformation($" --------------------- dentro de createnormalpayrollsasync, startdate es {startDate} y enddate es {endDate} y idbranch es {IdBranch}");
            // Verificamos si hay una nómina con esas fechas en la BD:
            var existsNormalPayroll = await _context.NormalPayrolls
                .AnyAsync(enp => enp.StartDate.Date == startDate.Date && enp.EndDate.Date == endDate.Date && enp.Active && enp.IdBranch == IdBranch);

            //_logger.LogInformation($"--------------------------------- existe nomina ya? {existsNormalPayroll}");  

            if (existsNormalPayroll) {
                return new NormalPayrollResult(3, $"Ya existe una nómina de esa sucursal en ese período ({startDate.Date} - {endDate.Date})");
            }

            // Checamos las incidencias de empleados en las fechas de inicio y final de la semana laboral en la tabla generada por el checador
            // y obtenemos los ids de esos empleados y los agregamos a las tablas de nomina
            // y se crea la nómina normal

            var employeeIdsCheck = await GetEmployeeIdsFromChecksAsync(startDate, endDate, IdBranch);

            //_logger.LogInformation($"-----------------------------EmployeeIds desde checkinsouts: " + string.Join(", ", employeeIdsCheck));

            // Se busca si hay una nomina digital con las mismas fechas del periodo laboral, SI NO EXISTE, TERMINA EL PROCESO
            // DEBE HABER UNA NOMINA DIGITAL YA CARGADA PARA CREAR UNA NOMINA NORMAL
            List<int> employeeIdsDP = new List<int>();
            if (PayrollId != 0)
            {
                // Validar que existe la nómina digital con el PayrollId proporcionado
                var existsPayroll = await _context.PayrollRecords
                    .AnyAsync(pr => pr.PayrollId == PayrollId && pr.IdBranch == IdBranch && pr.Active);

                if (!existsPayroll)
                {
                    _logger.LogWarning("No se encontró nómina digital con PayrollId {PayrollId} para la sucursal {IdBranch}", PayrollId, IdBranch);
                    return new NormalPayrollResult(2, "No se encontró la nómina digital especificada");
                }

                employeeIdsDP = await GetPayrollEmployeeIdsByBranchAsync(PayrollId, IdBranch);
                var update = await _payrollService.UpdateBlockPayroll(idBlockPeriod, PayrollId);
            }

            /*if (payrollId == 0)
            {
                _logger.LogWarning("---------------No hay nóminas digitales que correspondan a este período");
                return new NormalPayrollResult(2, "No hay nóminas digitales que correspondan a este período");
            }
            else
            {
                //_logger.LogInformation($"-----------------------------Se encontró la nómina digital con id {payrollId} y los empleados siguientes: ");
                //_logger.LogInformation($"-----------------------------EmployeeIds: " + string.Join(", ", employeeIdsDP));
                // Ya tienes el normalPayrollId y la lista employeeCodes  
            }*/

            var totalDPEarnings = await _context.PayrollEmployees
                .Where(pe => pe.PayrollId == PayrollId)
                .Select(pe => new
                {
                    EmployeeId = pe.EmployeeId,
                    TotalEarnings = pe.TotalEarnings
                })
                .ToListAsync();

            // aqui une los ids de los empleados encontrados en checkinsouts y en nomina digital
            var totalEmployeesIds = employeeIdsCheck.Union(employeeIdsDP).ToList();

            //_logger.LogInformation("-----------------------------Ids checador + ids nomina digital: " + string.Join(", ", totalEmployeesIds));

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

            //_logger.LogInformation("-----------------------------Datos del empleado: " + string.Join(", ", employeeData));

            // Obtengo las incidencias de los empleados en la tabla de incidencias de checkinsouts: 
            var incidentsxid = await _employeesxCheckInsOutsServices.IncidentsByEmployee(1, startDate, endDate);

            foreach (var item in incidentsxid)
            {
                //_logger.LogInformation($" -- Clave: {item.Key}, Valor: {item.Value}");
            }

            // Crea una nueva nómina normal:
            var normalpayroll = new NormalPayroll
            {
                IdBranch = IdBranch,
                IdBlockPeriod = idBlockPeriod,
                StartDate = startDate,
                EndDate = endDate,
                Closed = closed,
                NomDigital = PayrollId == 0 ? false : true, // Si no hay nómina digital, entonces es una nómina normal
                Active = true
            };

            //_logger.LogInformation($"---------------------------- el objeto normalPayroll contiene: {normalpayroll.IdBranch}");

            _context.NormalPayrolls.Add(normalpayroll);
            await _context.SaveChangesAsync();

            //_logger.LogInformation($"---------------------------- Nómina creada con ID: {normalpayroll.Id}");

            // Primero crea un diccionario que mapee ID de empleado con sus incidencias
            var allIncidents = new Dictionary<int, Dictionary<string, object>>();
            var specialExtraHoursDict = new Dictionary<int, decimal>();
            var porcentajeSpecial = await _context.HRManagement
                    .Where(h => h.IdBranch == IdBranch && h.Active)
                    .Select(h => h.SpecialOvertimePay)
                    .FirstOrDefaultAsync();
            var porcentajeExtra = await _context.HRManagement
                    .Where(h => h.IdBranch == IdBranch && h.Active)
                    .Select(h => h.OvertimePay)
                    .FirstOrDefaultAsync();


            // Recopila todas las incidencias para cada empleado
            foreach (int employeeId in totalEmployeesIds)
            {
                var employeeIncidents = await _employeesxCheckInsOutsServices.IncidentsByEmployee(employeeId, startDate, endDate);
                var employeSpecial = await _specialExtraHoursService.GetSpecialExtraHours(employeeId, startDate, endDate);
                var sumaHorasEspeciales = employeSpecial?.Sum(e => e.CalculatedSpecialExtraHoursInMinutes) ?? 0;
                specialExtraHoursDict[employeeId] = sumaHorasEspeciales;



                // Visualiza todo el diccionario de incidencias
                //_logger.LogInformation($"++++++++++++++++++++++++++");
                //_logger.LogInformation(JsonSerializer.Serialize(employeSpecial, new JsonSerializerOptions
                /*{
                    WriteIndented = true
                }));*/
                /*//_logger.LogInformation(JsonSerializer.Serialize(employeeIncidents, new JsonSerializerOptions 
                { 
                    WriteIndented = true 
                }));
                
                // Visualiza cada par clave-valor individualmente
                //_logger.LogInformation($"-----------------Desglose de incidencias para empleado ID {employeeId}:");

                foreach (var kvp in employeeIncidents)
                {
                    //_logger.LogInformation($"  ------------- Clave: {kvp.Key}, Valor: {kvp.Value}, Tipo: {kvp.Value?.GetType().Name ?? "null"}");
                }*/


                // Verificar si todos los valores numéricos son cero
                bool allZeros = true;

                // Lista de claves a verificar 
                var keysToCheck = new[] { "Hours" };

                foreach (var key in keysToCheck)
                {
                    if (employeeIncidents.TryGetValue(key, out var value) && value != null && Convert.ToDouble(value) > 0)
                    {
                        //_logger.LogInformation($"---------------- Se encontró valor no cero para {key}: {value}");

                        allZeros = false;
                        break;
                    }
                }

                // Solo agregar al diccionario si no todos los valores son ceros
                allIncidents[employeeId] = employeeIncidents;
            }

            // checamos el contenido del nuevo diccionario:
            //_logger.LogInformation("========== ALL INCIDENTS ==========");

            string jsonString = JsonSerializer.Serialize(allIncidents, new JsonSerializerOptions
            {
                WriteIndented = true
            });

            //_logger.LogInformation($"-----------------Todos los incidencias: {jsonString}");
            //_logger.LogInformation("==================================");

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
            var employeesList = totalEmployeesIds.Select(async id =>
            {
                // Verifica si tenemos incidencias para este empleado


                bool hasIncidents = allIncidents.TryGetValue(id, out var incidents);

                //Console.WriteLine($" ---CREANDO NUEVO EMPLOYEESXPAYROLL: ID {id} INCIDENTES bool {hasIncidents} incidentes {JsonSerializer.Serialize(incidents, new JsonSerializerOptions { WriteIndented = true })}");

                // Intenta obtener los datos del empleado del diccionario
                bool hasEmployeeData = employeeDataDict.TryGetValue(id, out var empData);

                bool hasTotalEarningData = totalEarningsxEmployeeDict.TryGetValue(id, out var earningData);
                //Console.WriteLine($" ---CREANDO NUEVO EMPLOYEESXPAYROLL: ID {id} totalearnings bool {hasTotalEarningData} ");

                // Valores predeterminados o calculados según las incidencias
                decimal workedHours = hasIncidents && incidents != null && incidents.TryGetValue("Hours", out var hours) ? Convert.ToDecimal(hours) : 0.0M;

                // Obtén el precio por hora del empleado si está disponible
                decimal priceXHour = hasEmployeeData && empData.PriceXHour != null ? Convert.ToDecimal(empData.PriceXHour) : 0.0M;

                decimal baseHours = await _employeesxClockService.GetEmployeeTotalHoursByDateRange(startDate, endDate, id);


                decimal specialWorkedHours = specialExtraHoursDict[id] / 60;
                decimal extraworkedhours = workedHours > baseHours ? (workedHours - baseHours) : 0.0M;
                decimal workedHoursnew = workedHours < baseHours ? workedHours : baseHours;
                decimal extraSalary = extraworkedhours * priceXHour * (decimal)porcentajeExtra;
                decimal specialSalary = specialWorkedHours * priceXHour * (decimal)porcentajeSpecial;
                decimal baseSalary = workedHoursnew * priceXHour;
                
    
                // Obtén otros valores del empleado
                decimal savings = hasEmployeeData && empData.Saving != null ? Convert.ToDecimal(empData.Saving) : 0.0M;
                

                decimal delays = hasIncidents && incidents.TryGetValue("Delays", out var delayValue) ? Convert.ToDecimal(delayValue) : 0.0M;
                decimal loan = hasEmployeeData && empData.Loan != null ? Convert.ToDecimal(empData.Loan) : 0.0M;
                
                decimal digitalpayment = hasTotalEarningData && earningData.TotalEarnings != null ? Convert.ToDecimal(earningData.TotalEarnings) : 0.0M;
                decimal grossSalary = specialSalary + baseSalary + extraSalary;
                decimal absences = 0.0M;
                /*if (incidents != null)
                {
                    Console.WriteLine($"==== Diccionario incidents (Empleado {id}) ====");
                    foreach (var kvp in allIncidents)
                    {
                        Console.WriteLine($"Key: {kvp.Key}, Value: {kvp.Value}, Type: {kvp.Value?.GetType()}");
                    }
                    Console.WriteLine("============================================");
                }
                else
                {
                    Console.WriteLine($"incidents es NULL para empleado {id}");
                }
               _logger.LogInformation($"***********++++++++++++++++Found Incidents for {id}: {JsonSerializer.Serialize(allIncidents)}");


               if (incidents != null && incidents.TryGetValue("Absence", out var absenceValue))
                {
                    Console.WriteLine($"////---------------+++ {id}Found Absences: {absenceValue} (type: {absenceValue?.GetType()})");
                    //_logger.WriteLine($"///---------------+++absenceValue es null para empleado ID {id}");
                    if (absenceValue != null)
                    {
                        absences = Convert.ToDecimal(absenceValue);
                    }
                    else
                    {
                        absences = 0.0M;
                        Console.WriteLine("---------------+++absenceValue es null");
                    }
                }
                else
                {
                    Console.WriteLine("---------------+++Clave 'Absences' no encontrada en el diccionario.");
                }

                _logger.LogInformation($"///////////////////////////////Gross Salary calculated for Employee ID: {id} is {absences}");
                */
                _logger.LogInformation($"***********++++++++++++++++Found Incidents for {id}: {JsonSerializer.Serialize(allIncidents)}");
                if (allIncidents.TryGetValue(id, out var employeeData))
                //_logger.LogInformation($"----------------+++++++++++*******Empleado {id} - Datos: {JsonSerializer.Serialize(employeeData)}");
                {
                    _logger.LogInformation($"----------------+++++++++++*******Empleado {id} - Datos: {JsonSerializer.Serialize(employeeData)}");
                    if (employeeData.TryGetValue("Absence", out var absenceValue))
                    {
                        absences = Convert.ToDecimal(absenceValue);
                        _logger.LogInformation($"----------------+++++++++++*******Empleado {id} - Absence: {absenceValue}");
                    }
                    else
                    {
                        _logger.LogWarning($"----------------+++++++++++*******El campo 'Absence' no existe para el empleado {id}.");
                    }
                }
                else
                {
                    _logger.LogWarning($"----------------+++++++++++*******No se encontró información para el empleado {id}.");
                }

                
                return new EmployeesByPayroll
                {
                    Id_employee = id,
                    Id_normalpayroll = normalpayroll.Id,
                    PriceXHour = priceXHour,
                    WorkedHours = workedHoursnew,
                    ExtraWorkedHours = extraworkedhours,
                    SpecialWorkedHours = specialWorkedHours,
                    BaseSalary = baseSalary,
                    ExtraSalary = extraSalary,
                    SpecialSalary = specialSalary,
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
                var employees = await Task.WhenAll(employeesList);
                await CalculateNormalPayrollXEmployee(normalpayroll.Id, employees.ToList(), startDate, endDate, IdBranch, null);

                foreach (var dato in employees) {
                    //_logger.LogInformation($"--------------- DESPUES DE CALCULATE quedan estos DATOS: {JsonSerializer.Serialize(dato, new JsonSerializerOptions { WriteIndented = true })}");
                }

                _context.EmployeesByPayroll.AddRange(employees);
                await _context.SaveChangesAsync();
            }

            var totales = await _context.EmployeesByPayroll
                .Where(e => e.Id_normalpayroll == normalpayroll.Id)
                .GroupBy(e => e.Id_normalpayroll)
                .Select(g => new
                {
                    TotalBaseWorkHours = g.Sum(e => (decimal?)e.WorkedHours ?? 0),
                    TotalBaseExtraHours = g.Sum(e => (decimal?)e.ExtraWorkedHours ?? 0),
                    TotalBaseExtraHoursSpecial = g.Sum(e => (decimal?)e.SpecialWorkedHours ?? 0),
                    TotalBaseSalary = g.Sum(e => (decimal?)e.BaseSalary ?? 0),
                    TotalExtraSalary = g.Sum(e => (decimal?)e.ExtraSalary ?? 0),
                    TotalSpecialSalary = g.Sum(e => (decimal?)e.SpecialSalary ?? 0),
                    TotalBonos = g.Sum(e => (decimal?)e.Bonus ?? 0),
                    TotalSubtotal = g.Sum(e => (decimal?)e.GrossSalary),
                    TotalSavings = g.Sum(e => (decimal?)e.Savings ?? 0),
                    TotalDescuentos = g.Sum(e => (decimal?)e.realDiscount ?? 0),
                    TotalDigitalPayment = g.Sum(e => (decimal?)e.DigitalPayment ?? 0),
                    TotalAbsence = g.Sum(e => (decimal?)e.Absences ?? 0),
                    TotalDelays = g.Sum(e => (decimal?)e.Delays ?? 0),
                    Total = g.Sum(e => (decimal?)e.Total ?? 0 ),
                    /*Total = g.Sum(e => (
                                (decimal?)e.BaseSalary ?? 0) +
                                ((decimal?)e.ExtraSalary ?? 0) +
                                ((decimal?)e.Bonus ?? 0) -
                                ((decimal?)e.realDiscount ?? 0) -
                                ((decimal?)e.DigitalPayment ?? 0)
                            )*/
                })
                .FirstOrDefaultAsync();


            // aqui calcula la nomina completa, totales de todos los empleados
            //_logger.LogInformation("--------------- Totales calculados: " + JsonSerializer.Serialize(totales, new JsonSerializerOptions { WriteIndented = true }));

            if (totales != null)
            {
                var normalPayroll2 = await _context.NormalPayrolls.FirstOrDefaultAsync(n => n.Id == normalpayroll.Id);
                if (normalPayroll2 != null)
                {
                    normalPayroll2.TotalBaseWorkingHours = totales.TotalBaseWorkHours;
                    normalPayroll2.TotalBaseExtraHours = totales.TotalBaseExtraHours;
                    normalPayroll2.TotalBaseExtraHoursSpecial = totales.TotalBaseExtraHoursSpecial;
                    normalPayroll2.TotalBaseSalary = totales.TotalBaseSalary;
                    normalPayroll2.TotalExtraSalary = totales.TotalExtraSalary;
                    normalPayroll2.TotalSpecialSalary = totales.TotalSpecialSalary;
                    normalPayroll2.TotalBonos = totales.TotalBonos;
                    normalPayroll2.TotalSubtotal = totales.TotalSubtotal;
                    normalPayroll2.TotalSavings = totales.TotalSavings;
                    normalPayroll2.TotalDescuentos = totales.TotalDescuentos;
                    normalPayroll2.TotalDigitalPayment = totales.TotalDigitalPayment;
                    normalPayroll2.TotalAbsence = totales.TotalAbsence;
                    normalPayroll2.TotalDelays = totales.TotalDelays;
                    normalPayroll2.Total = totales.Total;

                    await _context.SaveChangesAsync();
                }
            }

            //_logger.LogInformation("===== CONTENIDO DE totalEarningsxEmployeeDict =====");
            /*_logger.LogInformation(JsonSerializer.Serialize(totalEarningsxEmployeeDict, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            }));**/
            //_logger.LogInformation("===================================================");

            //_logger.LogInformation($"===== CONTENIDO DE totalDPEarnings ===== para la payrollid = {payrollId}");
            /*_logger.LogInformation(JsonSerializer.Serialize(totalDPEarnings, new JsonSerializerOptions 
            { 
                WriteIndented = true 
            }));*/
            //_logger.LogInformation("=======================================");

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
            if (items == null) { }
            else
            {

                if (items.discount > 0.0M || items.bonus > 0.0M)
                {
                    var employeeId = EmployeesList[0].Id_employee;

                    //_logger.LogInformation($"----------------- Modificando nómina normal con ID {NormalPayrollId} para el empleado {employeeId} con descuento {items.discount} y bono {items.bonus} y ahorro {items.savings}");

                    var payrollEmployee = await _context.EmployeesByPayroll
                        .FirstOrDefaultAsync(p => p.Id_normalpayroll == NormalPayrollId && p.Id_employee == employeeId && p.Active == true);

                    if (payrollEmployee == null)
                    {
                        //_logger.LogWarning($"No se encontró el registro de nómina para el empleado {employeeId} en la nómina normal con ID {NormalPayrollId}.");

                    }
                    else
                    {

                        //_logger.LogInformation($"----------------- Datos del empleado a modificar: {JsonSerializer.Serialize(payrollEmployee, new JsonSerializerOptions { WriteIndented = true })}");


                        if (items.discount > 0.0M)
                        {
                            //_logger.LogInformation($"----------------- Aplicando descuento de {items.discount} al empleado {employeeId}");



                            return;
                        }

                        if (items.bonus > 0.0M)
                        {
                            //_logger.LogInformation($"----------------- Aplicando bono de {items.bonus} al empleado {employeeId}");

                            // Aquí se calculan los bonos, se busca en la tabla de employeesxbonus para ver si hay registros de bonos por cada empleado:
                            // Este calculo debe realizarse DESPUÉS que se da de alta el bono en el componente de nómina
                            var totalBonus = await CalculateBonusXEmployee(employeeId, startDate, endDate, IdBranch);

                            payrollEmployee.Bonus = totalBonus;

                            //_logger.LogInformation($"----------------- Total de bonos para el empleado {employeeId}: {payrollEmployee.Bonus}");

                            return;
                        }

                        /*if (items.savings > 0.0M)
                        {
                            _logger.LogInformation($"----------------- Aplicando ahorro de {items.savings} al empleado {employeeId}");

                            // Aquí se checan los ahorros
                            var savingsResult = await _context.Loanandcredits
                            .Where(l => l.IdEmpleado == employeeId
                                        && l.Date >= startDate.Date
                                        && l.Date <= endDate.Date
                                        && l.Type == "AHORRO"
                                        && l.Active == true)
                            .Select(l => new { l.Monto, l.Payments })
                            .ToListAsync();

                            if (savingsResult.Count > 0)
                                payrollEmployee.Savings = savingsResult.Sum(l => (l.Monto ?? 0) - (l.Payments ?? 0));
                            else
                                payrollEmployee.Savings = 0.0M;

                            //_logger.LogInformation($"------------------- [NÓMINA] Ahorros: {employee.Savings}");



                            return;
                        }*/
                    }
                }
                
              

                try
                {

                   
                }
                catch (Exception ex)
                {
                    //_logger.LogError(ex, "Error al buscar el empleado con ID {EmployeeId} en la nómina normal con ID {NormalPayrollId}, error: {ex.Message}", employeeId, NormalPayrollId);
                    return; // Retorna si no se encuentra el empleado
                }

               
                    return; // Retorna si solo se modifica un empleado
            }

            try
            {
                // Aquí puedes implementar la lógica para calcular la nómina normal por empleado
                // utilizando el normalPayrollId proporcionado.
                // Por ejemplo, podrías buscar la nómina en la base de datos y realizar cálculos.

                //_logger.LogInformation($"----------------- Calculando nómina normal con ID {NormalPayrollId} para {EmployeesList.Count} empleados.");

                foreach (var employee in EmployeesList)
                {
                    //_logger.LogInformation($"----------------- CALCULATE Dato a guardar en employeexpayroll: {JsonSerializer.Serialize(employee, new JsonSerializerOptions { WriteIndented = true })}");

                    // Aquí se calculan los bonos, se busca en la tabla de employeesxbonus para ver si hay registros de bonos por cada empleado:

                    var totalBonus = await CalculateBonusXEmployee(employee.Id_employee, startDate, endDate, IdBranch);

                    employee.Bonus = totalBonus;

                    //_logger.LogInformation($"----------------- Total de bonos para el empleado {employee.Id_employee}: {employee.Bonus}");

                    // Salario Bruto
                    employee.GrossSalary = employee.BaseSalary + employee.SpecialSalary + employee.ExtraSalary + employee.Bonus;

                    // Aquí se checan los ahorros
                    /*var resultadoAhorros = await _context.Loanandcredits
                    .Where(l => l.IdEmpleado == employee.Id_employee
                                && l.Date >= startDate.Date
                                && l.Date <= endDate.Date
                                && l.Type == "AHORRO"
                                && l.Active == true)
                    .Select(l => new { l.Monto, l.Payments })
                    .ToListAsync();

                    if (resultadoAhorros.Count > 0)
                        employee.Savings = resultadoAhorros.Sum(l => (l.Monto ?? 0) - (l.Payments ?? 0));
                    else*/
                    employee.Savings = 0.0M;

                    //_logger.LogInformation($"------------------- [NÓMINA] Ahorros: {employee.Savings}");

                    var loanResults = await _loansAndCreditsService.LoansByEmployee(employee.Id_employee, "PRESTAMO");

                    loanResults = loanResults
                        .OrderBy(l => l.Date)
                        .ToList();

                    if (loanResults.Count > 0)
                    {
                        foreach (var loan in loanResults)
                        {
                            //_logger.LogInformation($"----------------- [NÓMINA] Prestamo: {loan.Id} | Monto: {loan.Monto} | Pagos: {loan.Payments} | Remanente: {loan.Remain} | Fecha: {loan.Date} | Tipo: {loan.Type}");
                        }

                        var totalMontos = loanResults.Sum(k => k.Monto ?? 0);                                   //resultadoPrestamos.Sum(l => l.Monto ?? 0);
                        var totalPayments = loanResults.Sum(l => l.Payments ?? 0);                              //resultadoPrestamos.Sum(l => l.Payments ?? 0);
                        var deudaPrestamos = totalMontos - totalPayments;

                        //_logger.LogInformation($"----------------- Total de prestamos para el empleado {employee.Id_employee}: Total en préstamos: {totalMontos} -- " +
                            //$"Total en Pagos: {totalPayments} -- Remanente: {deudaPrestamos}");

                        // obtiene los parámetros del setup de la nómina
                        var parameters = await _context.HRManagement
                            .FirstOrDefaultAsync(np => np.IdBranch == IdBranch && np.Active);

                        //_logger.LogInformation($"----------------- El empleado {employee.Id_employee} tiene un porcentaje de descuento de {parameters.Discount}% y si se aplica tendría ${deudaPrestamos * (parameters.Discount / 100)} descontado!");

                        var percentageDiscount = parameters.Discount / 100;

                        // el descuento se calcula con el salario bruto y el porcentaje de descuento
                        var discount = (employee.GrossSalary * percentageDiscount) > deudaPrestamos ? deudaPrestamos : (employee.GrossSalary * percentageDiscount);

                        employee.realDiscount = (decimal)discount;

                        //_logger.LogInformation($"----------------- Total de prestamos para el empleado {employee.Id_employee} quedaría: {deudaPrestamos} y su descuento quedaría en {discount}");

                        // Aquí se actualiza el descuento en la tabla de loansandcredits
                       /*var appliedPayments = ApplyLoanPayment(loanResults, (decimal)discount);

                        foreach (var payment in appliedPayments)
                        {
                            // Aquí se aplica el pago a los préstamos
                            await _conceptsxLoansCreditsService.Save(payment);
                            //_logger.LogInformation($"----------------- Pago aplicado a préstamo ID {payment.IdLoanAndCredit} por ${payment.Total} el {payment.Date:yyyy-MM-dd}");
                        }*/
                    }

                    employee.Total = employee.BaseSalary + employee.ExtraSalary + employee.SpecialSalary + employee.Bonus - employee.realDiscount - employee.DigitalPayment;

                    //_logger.LogInformation($"-----------------Empleado {employee.Id_employee} calculado correctamente. Total: {employee.Total}");
                    
                    //return; // Retorna true si el cálculo fue exitoso
                }
            }
            catch (Exception ex)
            {
                //_logger.LogError(ex, "Error al calcular la nómina normal con ID {NormalPayrollId}", NormalPayrollId);
                //return; // Retorna false si hubo un error
            }
        }


        public async Task<NormalPayroll?> UpdatePayrollClosing(int NormalPayrollId)
        {

            _logger.LogInformation($"-------------- entrando a SERVICE UPDATE PAYROLL CLOSING NormalPayroll ID: {NormalPayrollId}");

            try
            {

                var existingNP = await _context.NormalPayrolls.FindAsync(NormalPayrollId);

                if (existingNP == null)
                {
                    _logger.LogWarning("Attempted to update non-existent Normal Payroll with ID {NormalPayrollId}", NormalPayrollId);
                    return null;
                }

                _logger.LogInformation($"-------------- este es el resultado de la busqueda de NormalPayroll existente: {existingNP} para el id {NormalPayrollId}");
                if(existingNP.NomDigital == false)
                {
                    _logger.LogWarning("******+++**+*+*+++*+*+Normal Payroll with ID {NormalPayrollId} is not a digital payroll, cannot close", NormalPayrollId);
                    var payDigital = await _context.EmployeesByPayroll
                        .Where(p => p.Id_normalpayroll == NormalPayrollId && p.DigitalPayment == 0 && p.Active)
                        .ToListAsync();
                        int cantidad = payDigital.Count;

                    foreach (var empleado in payDigital)
                    {
                        var employee = await _context.Employees
                        .Where(e => e.Id == empleado.Id_employee && e.IdBank != null)
                        .FirstOrDefaultAsync();
                        if (employee != null)
                        {
                            Console.WriteLine($"Empleado ID: {employee.Id}");
                            return null;
                        }
                    }

                    //_logger.LogWarning("******+++**+*+*+++*+*+Empleados en nómina digital sin pago digital aplicado: " + JsonSerializer.Serialize(payDigital, new JsonSerializerOptions { WriteIndented = true }));
                }
                // Aplicar pagos de préstamos antes de cerrar la nómina
                var pagosAplicados = await ApplyLoanPayment(NormalPayrollId);
                var pagossNegativos = await ApplyNegativeBalance(NormalPayrollId);
                existingNP.Closed = true;

                // Salvamos los cambios en la base de datos
                await _context.SaveChangesAsync();

                // Updates the changes to the database on table NormalPayrolls and EmployeesByPayroll

                _logger.LogInformation("Normal Payroll with ID {NormalPayrollId} updated successfully", NormalPayrollId);

                return existingNP;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Normal Payroll with ID {NormalPayrollId}", NormalPayrollId);
                throw;
            }
        }

        public async Task<List<ConceptsxLoansCredit>> ApplyLoanPayment(int NormalPayrollId)
        {
            _logger.LogInformation($"-------------- Aplicando pagos de préstamos para nómina ID: {NormalPayrollId}");

            var movements = new List<ConceptsxLoansCredit>();

            try
            {
                var fechaFin = await _context.NormalPayrolls
                    .Where(np => np.Id == NormalPayrollId)
                    .Select(np => np.EndDate)
                    .FirstOrDefaultAsync();

                var empleados = await _context.EmployeesByPayroll
                    .Where(em => em.Id_normalpayroll == NormalPayrollId && em.Active)
                    .ToListAsync();

                foreach (var empleado in empleados)
                {
                    // Recalcular el saldo real de préstamos (más confiable que loan.Remain)
                    var loans = await _context.Loanandcredits
                        .Where(l => l.IdEmpleado == empleado.Id_employee 
                                && l.Type == "PRESTAMO" 
                                && l.Active == true)
                        .OrderBy(l => l.Date)
                        .ToListAsync();

                    if (!loans.Any())
                    {
                        _logger.LogInformation($"-------------- Empleado {empleado.Id_employee} no tiene préstamos activos");
                        continue;
                    }

                    // Filtrar solo préstamos con saldo pendiente
                    var loansWithBalance = new List<(Loanandcredit loan, decimal currentBalance)>();
                    
                    foreach (var loan in loans)
                    {
                        // Calcular pagos actuales del préstamo
                        var currentPayments = await _context.ConceptsxLoansCredits
                            .Where(c => c.IdLoanAndCredit == loan.Id && c.Active)
                            .SumAsync(c => c.Total);
                            
                        var currentBalance = (loan.Monto ?? 0) - currentPayments;
                        
                        if (currentBalance > 0)
                        {
                            loansWithBalance.Add((loan, currentBalance));
                        }
                    }

                    if (!loansWithBalance.Any())
                    {
                        _logger.LogInformation($"-------------- Empleado {empleado.Id_employee} no tiene préstamos con saldo pendiente");
                        continue;
                    }

                    // Monto disponible para pagar (descuento real calculado)
                    decimal paymentAmount = empleado.realDiscount;

                    _logger.LogInformation($"-------------- Empleado {empleado.Id_employee} tiene ${paymentAmount} disponible para pagar préstamos");

                    if (paymentAmount <= 0)
                    {
                        _logger.LogInformation($"-------------- Empleado {empleado.Id_employee} no tiene monto disponible para pagar préstamos");
                        continue;
                    }

                    // Aplicar pagos a los préstamos del empleado
                    foreach (var (loan, currentBalance) in loansWithBalance)
                    {
                        if (paymentAmount <= 0)
                        {
                            break; // Si ya no hay monto para pagar, salimos del bucle
                        }

                        decimal applied = Math.Min(paymentAmount, currentBalance);

                        if (applied > 0)
                        {
                            // Crear el concepto del pago
                            var movement = new ConceptsxLoansCredit
                            {
                                IdLoanAndCredit = loan.Id,
                                Date = fechaFin,
                                Total = applied,
                                FromPayroll = true,
                                Status = "APLICADO",
                                Comments = $"Pago aplicado de ${applied} a préstamo ID {loan.Id} desde cierre de nómina {NormalPayrollId}",
                                Active = true
                            };

                            movements.Add(movement);
                            paymentAmount -= applied;

                            _logger.LogInformation($"-------------- Pago aplicado: ${applied} al préstamo ID {loan.Id} del empleado {empleado.Id_employee}");
                        }
                    }
                }

                // Guardar los movimientos y actualizar la tabla de préstamos
                if (movements.Any())
                {
                    // Usar transacción para asegurar consistencia
                    using var transaction = await _context.Database.BeginTransactionAsync();
                    
                    try
                    {
                        // 1. Guardar los conceptos de pago
                        await _context.ConceptsxLoansCredits.AddRangeAsync(movements);
                        await _context.SaveChangesAsync();

                        // 2. Actualizar el campo Payments en cada préstamo afectado
                        var loanIds = movements.Select(m => m.IdLoanAndCredit).Distinct();
                        
                        foreach (var loanId in loanIds)
                        {
                            var loan = await _context.Loanandcredits.FindAsync(loanId);
                            if (loan != null)
                            {
                                // Recalcular total de pagos para este préstamo
                                var totalPayments = await _context.ConceptsxLoansCredits
                                    .Where(c => c.IdLoanAndCredit == loanId && c.Active)
                                    .SumAsync(c => c.Total);
                                
                                loan.Payments = totalPayments;
                            }
                        }
                        
                        await _context.SaveChangesAsync();

                        // 3. Actualizar el campo Loan en la tabla Employees para los empleados afectados
                        var employeeIds = movements
                            .Join(_context.Loanandcredits, m => m.IdLoanAndCredit, l => l.Id, (m, l) => l.IdEmpleado)
                            .Distinct();

                        foreach (var employeeId in employeeIds)
                        {
                            var employee = await _context.Employees.FindAsync(employeeId);
                            if (employee != null)
                            {
                                // Recalcular total de préstamos pendientes del empleado
                                var loanSum = await _context.Loanandcredits
                                    .Where(lc => lc.IdEmpleado == employeeId && lc.Type == "PRESTAMO" && lc.Active)
                                    .SumAsync(lc => (decimal?)((lc.Monto ?? 0) - (lc.Payments ?? 0))) ?? 0;
                                
                                employee.Loan = loanSum;
                            }
                        }
                        
                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                        
                        _logger.LogInformation($"-------------- Se aplicaron {movements.Count} pagos de préstamos exitosamente");
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError(ex, "Error en transacción de pagos de préstamos");
                        throw;
                    }
                }

                return movements;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error aplicando pagos de préstamos para nómina ID {NormalPayrollId}", NormalPayrollId);
                throw;
            }
        }

        public async Task<List<ConceptsxLoansCredit>> ApplyNegativeBalance(int NormalPayrollId)
        {
            _logger.LogInformation($"-------------- Aplicando pagos de préstamos para nómina ID: {NormalPayrollId}");

            var movements = new List<ConceptsxLoansCredit>();

            try
            {
                var fechaFin = await _context.NormalPayrolls
                    .Where(np => np.Id == NormalPayrollId)
                    .Select(np => np.EndDate)
                    .FirstOrDefaultAsync();

                var fechaInicio = await _context.NormalPayrolls
                    .Where(np => np.Id == NormalPayrollId)
                    .Select(np => np.StartDate)
                    .FirstOrDefaultAsync();

                var idblock = await _context.NormalPayrolls
                    .Where(np => np.Id == NormalPayrollId)
                    .Select(np => np.IdBlockPeriod)
                    .FirstOrDefaultAsync();


                var nombre = await _context.IdBlockPeriods
                    .Where(np => np.Id == idblock)
                    .Select(np => np.BlockPeriodCode)
                    .FirstOrDefaultAsync();

                var empleados = await _context.EmployeesByPayroll
                    .Where(em => em.Id_normalpayroll == NormalPayrollId && em.Active)
                    .ToListAsync();

                foreach (var empleado in empleados)
                {
                    // Recalcular el saldo real de préstamos (más confiable que loan.Remain)
                    var Negative = _context.EmployeesByPayroll
                        .Where(l => l.Id_employee == empleado.Id_employee
                                && l.Total < 0
                                && l.Active == true)
                        .ToList();
                    if (Negative.Count == 0)
                    {
                        _logger.LogInformation($"/////////////-------------- Empleado {empleado.Id_employee} no tiene balance negativo");
                        continue;
                    }
                    else
                    {
                        var saldo = Math.Abs(empleado.Total);
                        var respu = await _loansAndCreditsService.Save(new Loanandcredit
                        {
                            IdEmpleado = empleado.Id_employee,
                            Monto = saldo,
                            Date = fechaFin,
                            Type = "PRESTAMO",
                            FromPayroll = true,
                            Comments = $"Préstamo generado por balance negativo de nómina del {nombre}",
                            Active = true
                        });
                        _logger.LogInformation($"/////////////-------------- Empleado {empleado.Id_employee} tiene balance negativo de {saldo}");
                    }
                    
                }

                return movements;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error aplicando pagos de préstamos para nómina ID {NormalPayrollId}", NormalPayrollId);
                throw;
            }
        }

        public async Task<IEnumerable<NormalPayrollDTO>> GetAllNormalPayrollsAsync(int idBranch)
        {

            _logger.LogInformation($"--------------------- dentro de SERVICE getallnormalpayrollsasync, idbranch es {idBranch}");

            try
            {
                if (idBranch < 0)
                {

                    // List<BranchesApiData> branches = await _branchesService.GetBranchesData(-idBranch);

                    var branchIdsString = await _context.ActiveBranchIds
                        .Where(a => a.idCompany == -idBranch)
                        .Select(a => a.BranchIds)
                        .FirstOrDefaultAsync();

                    var branchIds = branchIdsString?
                        .Split(',', StringSplitOptions.RemoveEmptyEntries)
                        .Select(int.Parse)
                        .ToList();

                    //foreach (var branch in branchIds)
                    //{
                    //    _logger.LogInformation($"--------------------- dentro de SERVICE getallnormalpayrollsasync, branch es {JsonSerializer.Serialize(branch)}");
                    //}

                    var resultado = new List<NormalPayrollDTO>();

                    var normalPayrolls = await _context.NormalPayrolls
                        .Where(p => branchIds.Contains(p.IdBranch) && p.Active == true)
                        .Select(p => new NormalPayrollDTO
                        {
                            Id = p.Id,
                            IdBranch = p.IdBranch,
                            IdBlockPeriod = p.IdBlockPeriod,
                            StartDate = p.StartDate,
                            EndDate = p.EndDate,
                            TotalBaseWorkingHours = p.TotalBaseWorkingHours,
                            TotalBaseExtraHours = p.TotalBaseExtraHours,
                            TotalBaseExtraHoursSpecial = p.TotalBaseExtraHoursSpecial,
                            TotalBaseSalary = p.TotalBaseSalary,
                            TotalExtraSalary = p.TotalExtraSalary,
                            TotalSpecialSalary = p.TotalSpecialSalary,
                            TotalSubtotal = p.TotalSubtotal,
                            TotalBonos = p.TotalBonos,
                            TotalDescuentos = p.TotalDescuentos,
                            TotalSavings = p.TotalSavings,
                            TotalDigitalPayment = p.TotalDigitalPayment,
                            Total = p.Total,
                            NomDigital = p.NomDigital,
                            TotalAbsence = p.TotalAbsence,
                            TotalDelays = p.TotalDelays,
                            Closed = p.Closed,
                            Active = p.Active
                        })
                        .OrderByDescending(p => p.StartDate)
                        .AsNoTracking()
                        .ToListAsync();

                    return normalPayrolls;
                }
                else
                {
                    var result = await _context.NormalPayrolls
                        .Where(p => p.IdBranch == idBranch && p.Active == true)
                        .Select(p => new NormalPayrollDTO
                        {
                            Id = p.Id,
                            IdBranch = p.IdBranch,
                            StartDate = p.StartDate,
                            IdBlockPeriod = p.IdBlockPeriod,
                            EndDate = p.EndDate,
                            TotalBaseWorkingHours = p.TotalBaseWorkingHours,
                            TotalBaseExtraHours = p.TotalBaseExtraHours,
                            TotalBaseExtraHoursSpecial = p.TotalBaseExtraHoursSpecial,
                            TotalBaseSalary = p.TotalBaseSalary,
                            TotalExtraSalary = p.TotalExtraSalary,
                            TotalSpecialSalary = p.TotalSpecialSalary,
                            TotalSubtotal = p.TotalSubtotal,
                            TotalBonos = p.TotalBonos,
                            TotalDescuentos = p.TotalDescuentos,
                            TotalSavings = p.TotalSavings,
                            TotalDigitalPayment = p.TotalDigitalPayment,
                            Total = p.Total,
                            NomDigital = p.NomDigital,
                            TotalAbsence = p.TotalAbsence,
                            TotalDelays = p.TotalDelays,
                            Closed = p.Closed,
                            Active = p.Active
                        })
                        .OrderByDescending(p => p.StartDate)
                        .AsNoTracking()
                        .ToListAsync();

                    return result;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving NormalPayrolls for Branch ID {Id}", idBranch);
                throw;
            }
        }

        // Método para obtener empleados por ID de nómina
        public async Task<List<EmployeesByPayrollDTO>> GetEmployeesByNormalPayrollIdAsync(int normalPayrollId)
            {
                try 
                {
                    // Verificamos si la nómina existe
                    var normalPayroll = await _context.NormalPayrolls
                        .FirstOrDefaultAsync(np => np.Id == normalPayrollId && np.Active == true);

                    Console.WriteLine($"--------------------- dentro de getemployeesbynormalpayrollid, normalpayroll es {normalPayroll}");   
                    //Console.WriteLine($"--------------------- Id: {normalPayroll.Id}, Active: {normalPayroll.Active}");
   
                    if (normalPayroll == null)
                    {
                        return new List<EmployeesByPayrollDTO>();
                    }

                    Console.WriteLine($"--------------------- CONTINUA EL FLUJO A BUSCAR LOS EMPLEADOS DE LA NOMINA {normalPayrollId}");


                        var empleados = await _context.EmployeesByPayroll
                            .Where(e => e.Id_normalpayroll == normalPayrollId)
                            .Join(
                                _context.Employees,
                                ebp => ebp.Id_employee, // Clave externa en EmployeesByPayroll
                                emp => emp.Id,          // Clave primaria en Employees
                                (ebp, emp) => new { EmployeesByPayroll = ebp, Employee = emp }
                            )
                            .GroupJoin(
                                _context.Banks,
                                combined => combined.Employee.IdBank, // Clave externa en Employees
                                bank => bank.Id,                      // Clave primaria en Banks
                                (combined, banks) => new { combined, bank = banks.FirstOrDefault() } // LEFT JOIN con DefaultIfEmpty()
                            )
                            .Select(result => new EmployeesByPayrollDTO
                            {
                                Id = result.combined.EmployeesByPayroll.Id,
                                Id_employee = result.combined.EmployeesByPayroll.Id_employee,
                                Id_normalpayroll = result.combined.EmployeesByPayroll.Id_normalpayroll,
                                PriceXHour = result.combined.EmployeesByPayroll.PriceXHour,
                                WorkedHours = result.combined.EmployeesByPayroll.WorkedHours,
                                ExtraWorkedHours = result.combined.EmployeesByPayroll.ExtraWorkedHours,
                                SpecialWorkedHours = result.combined.EmployeesByPayroll.SpecialWorkedHours,
                                BaseSalary = result.combined.EmployeesByPayroll.BaseSalary,
                                GrossSalary = result.combined.EmployeesByPayroll.GrossSalary,
                                ExtraSalary = result.combined.EmployeesByPayroll.ExtraSalary,
                                SpecialSalary = result.combined.EmployeesByPayroll.SpecialSalary,
                                Bonus = result.combined.EmployeesByPayroll.Bonus,
                                PercentageDiscount = result.combined.EmployeesByPayroll.PercentageDiscount,
                                Savings = result.combined.EmployeesByPayroll.Savings,
                                Absences = result.combined.EmployeesByPayroll.Absences,
                                Delays = result.combined.EmployeesByPayroll.Delays,
                                Banco = result.combined.Employee.IdBank ?? 0,  // Si es NULL, devuelve 0
                                BancoNombre = result.bank != null ? result.bank.Name : "EFECTIVO", // Si no hay coincidencia, devuelve "SIN BANCO"
                                realDiscount = result.combined.EmployeesByPayroll.realDiscount,
                                DigitalPayment = result.combined.EmployeesByPayroll.DigitalPayment,// result.bank == null ? 0 :
                                Total = result.combined.EmployeesByPayroll.Total,
                                Active = result.combined.EmployeesByPayroll.Active,
                                EmployeeName = result.combined.Employee.Name
                            })
                            .OrderBy(e => e.EmployeeName)
                            .ToListAsync();

                        foreach (var empleado in empleados)
                        {
                            _logger.LogInformation($"Empleado: ID={empleado.Id}, Nombre={empleado.EmployeeName}, Banco={empleado.BancoNombre}, Total={empleado.Total}, SpecialWorkedHours={empleado.SpecialWorkedHours}, SpecialSalary={empleado.SpecialSalary}");
                        }

                    return empleados;    
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Error al obtener los empleados de la nómina {normalPayrollId}");
                    throw;
                }
        }        

        public async Task<NormalPayrollResult> DeleteNormalPayrollAsync(int id)
        {

            Console.WriteLine($"--------------------- dentro de deleteNormalPayrollAsync, id es {id}");
            var existingNormalPayroll = await _context.NormalPayrolls.FindAsync(id);
            Console.WriteLine($"--------------------- dentro de deleteNormalPayrollAsync, existingNormalPayroll es {existingNormalPayroll.Active}");

            if (existingNormalPayroll == null)
            {
                return new NormalPayrollResult(7, $"No se encontró la nómina con ID {id}");
            }

            try
            {
                var fechaFin = existingNormalPayroll.EndDate.Date;
            
                using var transaction = await _context.Database.BeginTransactionAsync();

                await _context.EmployeesByPayroll
                    .Where(e => e.Id_normalpayroll == id)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(e => e.Active, false)
                    );

                var start = existingNormalPayroll.StartDate.Date;
                var end = existingNormalPayroll.EndDate.Date;

                var payrollrecordId = await _context.PayrollRecords
                    .Where(dp => dp.IdBranch == existingNormalPayroll.IdBranch && dp.StartDate.Date == start && dp.EndDate.Date == end)
                    .Select(dp => dp.PayrollId)
                    .FirstOrDefaultAsync();

                await _context.PayrollRecords
                    .Where(dp => dp.IdBranch == existingNormalPayroll.IdBranch && dp.StartDate.Date == start && dp.EndDate.Date == end)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(dp => dp.Active, false)
                    );

                if (payrollrecordId > 0) {
                    await _context.PayrollEmployees
                        .Where(pemp => pemp.PayrollId == payrollrecordId)
                        .ExecuteDeleteAsync();
                }
                var conceptos = await _context.ConceptsxLoansCredits
                    .Where(c => c.FromPayroll == true && c.Date.Date == fechaFin && c.Active == true)
                    .ToListAsync();
                foreach (var concepto in conceptos)
                {
                    await _conceptsxLoansCreditsService.Delete(concepto.Id);
                }
                var ahorros = await _context.Loanandcredits
                    .Where(l => l.Type == "AHORRO" && l.FromPayroll == true && l.Date == fechaFin && l.Active == true)
                    .ToListAsync();
                foreach (var ahorro in ahorros)
                {
                    await _loansAndCreditsService.Delete(ahorro.Id);
                }

                var bonus = await _context.EmployeesxBonus
                    .Where(l => l.FromPayroll == true && l.IncidenceDate == fechaFin && l.Active == true)
                    .ToListAsync();
                foreach (var bono in bonus)
                {
                    await DeleteEmployeeByBonusAsync(bono.Id);
                }

                var prestamos = await _context.Loanandcredits
                    .Where(l => l.Type == "PRESTAMO" && l.FromPayroll == true && l.Date == fechaFin && l.Active == true)
                    .ToListAsync();
                foreach (var prestamo in prestamos)
                {
                    await _loansAndCreditsService.Delete(prestamo.Id);
                }

                existingNormalPayroll.Active = false;
                
                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return new NormalPayrollResult(6, $"Nómina eliminada con éxito");
            }
            catch (Exception ex)
            {
               return new NormalPayrollResult(8, $"Error al eliminar la nómina: {ex.Message}");
            }
        }

        public async Task<EmployeesxBonus?> Update(int id, EmployeesxBonus bonus)
        {

            _logger.LogInformation($"-------------- este es bonus entrando a SERVICE UPDATE BONUS ID: {id} BONUS: {bonus}");

            try
            {

                var existingBonus = await _context.EmployeesxBonus.FindAsync(id);

                if (existingBonus == null)
                {
                    _logger.LogWarning("Attempted to update non-existent Bonus Employee with ID {Id}", id);
                    _logger.LogWarning("Failed to update Bonus Employee with ID {Id}", id);
                    return null;
                }

                _logger.LogInformation($"-------------- este es el resultado de la busqueda de bono existente: {existingBonus} para el id {id}");

                // Actualizamos los campos del bono existente
                //existingBonus.Id = bonus.Id;
                existingBonus.IdEmployee = bonus.IdEmployee;
                existingBonus.IdBranch = bonus.IdBranch;
                existingBonus.IdBonus = bonus.IdBonus;
                existingBonus.EmployeeName = bonus.EmployeeName;
                existingBonus.Vigente = bonus.Vigente;
                existingBonus.IncidenceDate = bonus.IncidenceDate.Date;
                existingBonus.Active = bonus.Active;

                // Salvamos los cambios en la base de datos
                await _context.SaveChangesAsync();

                // Buscar la nómina correspondiente al bono actualizado o nuevo
                // y actualizar el total del empleado en la nómina
                var payroll = await _context.NormalPayrolls
                    .Where(p => p.IdBranch == existingBonus.IdBranch
                                && p.Active == true
                                && existingBonus.IncidenceDate >= p.StartDate
                                && existingBonus.IncidenceDate <= p.EndDate)
                    .FirstOrDefaultAsync();
                _logger.LogInformation($"--------------------- dentro de updatebonus, id Payroll es {payroll?.Id}");
                if (payroll != null)
                {
                    await PayrollRecalculate(payroll.Id);
                }
                else
                {
                    _logger.LogInformation($"----------- DENTRO DE UPDATEBONUS No se encontró nómina activa en el periodo para el bono con fecha {{existingBonus.IncidenceDate:yyyy-MM-dd}} y sucursal {{existingBonus.IdBranch}}");
                }

                // Updates the changes to the database on table NormalPayrolls and EmployeesByPayroll

                _logger.LogInformation("Bonus Employee with ID {Id} updated successfully", id);

                _logger.LogInformation("Bono actualizado correctamente con ID {Id}", id);
                return existingBonus;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Bonus Employee with ID {Id}", id);
                throw;
            }
        }

        public async Task<NormalPayrollResult> DeleteEmployeeByBonusAsync(int id)
        {
            _logger.LogInformation($"--------------------- dentro de deleteemployeebybonusAsync, id es {id}");

            var existingBonus = await _context.EmployeesxBonus.FindAsync(id);

            if (existingBonus == null)
            {
                return new NormalPayrollResult(7, $"No se encontró bono con ID {id}");
            }

            _logger.LogInformation($"--------------- esto contiene existingBonus: {existingBonus}");

            // Iniciamos la transacción
            //using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                existingBonus.Active = false;

                /*
                var payroll = await _context.NormalPayrolls
                    .Where(p => p.IdBranch == existingBonus.IdBranch
                                && p.Active == true)
                    .FirstOrDefaultAsync();

                _logger.LogInformation($"--------------------- dentro de deleteemployeebybonusAsync, id Payroll es {payroll.Id}");

                if (payroll != null)
                {
                    
                    var employeePayroll = await _context.EmployeesByPayroll
                        .Where(e => e.Id_employee == existingBonus.IdEmployee
                                    && e.Id_normalpayroll == payroll.Id
                                    && e.Active == true)
                        .FirstOrDefaultAsync();

                    _logger.LogInformation($"------------------------ dentro de deleteemployee, employeePayroll bonus es {employeePayroll.Bonus}");
                    _logger.LogInformation($"-------------------------dentro de deletebonus, employeepayroll total es {employeePayroll.Total}");

                    if (employeePayroll != null)
                    {
                        var valueAdditionStr = await _context.CatalogByType
                            .Where(c => c.Id == existingBonus.IdBonus)
                            .Select(c => c.ValueAddition)
                            .FirstOrDefaultAsync();

                        decimal quantity = 0.0M;

                        if (!string.IsNullOrWhiteSpace(valueAdditionStr))
                            decimal.TryParse(valueAdditionStr, out quantity);

                        _logger.LogInformation($"-------------------------dentro de deletebonus, el valor del bono es {quantity}");

                        employeePayroll.Bonus -= quantity;

                        _logger.LogInformation($"-------------------------dentro de deletebonus, los calculos son: Bonos: {employeePayroll.Bonus} y el total es {employeePayroll.Total} y el total de la nomina es {payroll.Total}");

                    } 
                }
                else 
                {
                    _logger.LogInformation($"----------- DENTRO DE DELETEBONUS no se encontró nomina (fechas) para afectar de acuerdo a este bono: {payroll}");
                }
                */

                await _context.SaveChangesAsync();

                // aqui debe ir el recalculo de nomina

                //await PayrollRecalculate(payroll.Id);
                //await transaction.CommitAsync();

                return new NormalPayrollResult(6, $"Bono eliminado");
            }
            catch (Exception ex)
            {
                //await transaction.RollbackAsync();
                return new NormalPayrollResult(8, $"Error al eliminar el bono {ex.Message}");
            }
        }

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

                        foreach (var emp in listaEmpleados)
                        {
                            var totalBonos = await _context.EmployeeBonusValues
                                .Where(eb => eb.IdEmployee == emp
                                    && eb.IdBranch == payroll.IdBranch
                                    && eb.IncidenceDate >= start
                                    && eb.IncidenceDate <= end)
                            .SumAsync(eb => eb.ValueAddition);
                            _logger.LogInformation($"------------------- RECALCULATE: Total de bonos para el empleado {emp} en la nómina {payrollId}: {totalBonos}");

                            var porcentaje = await _context.HRManagement
                                .Where(h => h.IdBranch == payroll.IdBranch && h.Active)
                                .Select(h => h.Discount)
                                .FirstOrDefaultAsync();
                            _logger.LogInformation($"------------------- RECALCULATE: Porcentaje de descuento para la nómina {payrollId} es: {porcentaje}");
                                
                            var Deuda = await _context.Loanandcredits
                                .Where(l => l.IdEmpleado == emp
                                    && l.Type == "PRESTAMO"
                                    && l.Active == true)
                                .SumAsync(l => (l.Monto ?? 0) - (l.Payments ?? 0));
                            _logger.LogInformation($"------------------- RECALCULATE: Deuda total para el empleado {emp} es: {Deuda}");

                            var entity = await _context.EmployeesByPayroll
                                .FirstOrDefaultAsync(e => e.Id_employee == emp && e.Id_normalpayroll == payrollId && e.Active);

                            if (entity != null)
                            {
                                entity.Bonus = totalBonos;
                                entity.GrossSalary = entity.BaseSalary + entity.ExtraSalary + totalBonos + entity.SpecialSalary;
                                var porcentajeDecimal = porcentaje ?? 0;
                                entity.realDiscount = (entity.GrossSalary * (porcentajeDecimal / 100)) > Deuda ? Deuda : (entity.GrossSalary * (porcentajeDecimal / 100));
                                entity.Total = entity.GrossSalary - entity.realDiscount - entity.Savings - entity.DigitalPayment;
                                await _context.SaveChangesAsync();
                            }

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

                    _logger.LogInformation($"------------------- RECALCULATE: Estos son los resultados de las sumas: Workedhrs: {calculation.TotalWorkedHours} BaseSalary {calculation.TotalBaseSalary} Bonus {calculation.TotalBonus} GrossSalary {calculation.TotalGrossSalary} Realdiscount {calculation.TotalRealDiscount} DigitalP {calculation.TotalDigitalPayment} Total {calculation.TotalPayroll} digitalP {calculation.TotalDigitalPayment}");

                    await _context.NormalPayrolls
                        .Where(np => np.Id == payrollId)
                        .ExecuteUpdateAsync(setters => setters
                            .SetProperty(np => np.TotalBaseWorkingHours, calculation.TotalWorkedHours)
                            .SetProperty(np => np.TotalBaseExtraHours, calculation.TotalExtraWorkedHours)
                            .SetProperty(np => np.TotalBonos, calculation.TotalBonus)
                            .SetProperty(np => np.TotalSubtotal, calculation.TotalGrossSalary)
                            .SetProperty(np => np.TotalDescuentos, calculation.TotalRealDiscount)
                            .SetProperty(np => np.Total, calculation.TotalPayroll)                            
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