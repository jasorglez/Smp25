using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.View;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class EmployeesxCheckInsOutsService : IEmployeesXCheckInsOutsService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<EmployeesxCheckInsOutsService> _logger;
    private readonly IEmployeesXClockService _employeesxClockService;
    private readonly IGetBranchesByCompanyService _branchesService;
    private readonly ISpecialExtraHoursService _specialExtraHoursService;


    public EmployeesxCheckInsOutsService(
        DbTrackingContext context,
        ILogger<EmployeesxCheckInsOutsService> logger,
        IEmployeesXClockService employeesxClockService,
        IGetBranchesByCompanyService branchesService,
        ISpecialExtraHoursService specialExtraHoursService)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _employeesxClockService = employeesxClockService ?? throw new ArgumentNullException(nameof(employeesxClockService));
        _branchesService = branchesService ?? throw new ArgumentNullException(nameof(branchesService));
        _specialExtraHoursService = specialExtraHoursService ?? throw new ArgumentNullException(nameof(specialExtraHoursService));
    }
    
    private async Task<string> CalculateSpecialExtraHours(int idEmployee, DateTime startDate, DateTime endDate)
    {
        try
        {
            var specialExtraHours = await _specialExtraHoursService.GetSpecialExtraHours(idEmployee, startDate, endDate);
            var totalMinutes = specialExtraHours.Sum(seh => seh.CalculatedSpecialExtraHoursInMinutes);
            int hours = totalMinutes / 60;
            int minutes = totalMinutes % 60;
            return $"{hours}:{minutes:00}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculando horas extra especiales para empleado {IdEmployee}", idEmployee);
            return "0:00";
        }
    }

    public async Task<List<object>> AllChecks(int idBranch)
    {
        try
        {
            if (idBranch >= 0)
            {
                return await _context.EmployeesxCheckInsOutsViews
                    .Where(c => c.IdBranch == idBranch)
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.Hour)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            else
            {
                var branches = (await _branchesService.GetBranchesData(-idBranch))
                .OrderBy(b => b.Name) // o .OrderByDescending(...) si quieres orden inverso
                .ToList();

            var result = new List<object>();

            foreach (var branch in branches)
            {
                var checks = await _context.EmployeesxCheckInsOutsViews
                    .Where(c => c.IdBranch == branch.Id)
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.Hour)
                    .AsNoTracking()
                    .ToListAsync<object>();

                result.AddRange(checks);
            }

            return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }

    public async Task<List<object>> ChecksByBranch(int idBranch, DateTime start, DateTime end)
    {
        try
        {
            var adjustedEnd = end.AddDays(1);

            if (idBranch >= 0)
            {
                return await _context.EmployeesxChecks
                    .Where(c => c.TimeStamp >= start && c.TimeStamp <= adjustedEnd && c.Active == true)
                    .Join(
                        _context.Employees,
                        check => check.IdEmployee,
                        emp => emp.Id,
                        (check, emp) => new
                        {
                            check.Id,
                            idEmployee = emp.Id,
                            emp.Name,
                            emp.IdBranch,
                            check.TimeStamp,
                            check.MinuteDiscount,
                            check.Type,
                            check.Valid
                        })
                    .Where(e => e.IdBranch == idBranch)
                    .OrderByDescending(e => e.TimeStamp)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            else
            {
                var branches = await _context.Employeexbranchs
                    .Where(e => e.IdRoot == -idBranch)
                    .Select(e => new BranchesApiData
                    {
                        Id = e.IdBranches,
                        Name = e.Namebranch
                    })
                    .Distinct()
                    .OrderBy(e => e.Name)
                    .AsNoTracking()
                    .ToListAsync();
                var result = new List<object>();

                foreach (var branch in branches)
                {
                    var checks = await _context.EmployeesxChecks
                        .Where(c => c.TimeStamp >= start && c.TimeStamp <= adjustedEnd && c.Active == true)
                        .Join(
                            _context.Employees,
                            check => check.IdEmployee,
                            emp => emp.Id,
                            (check, emp) => new
                            {
                                check.Id,
                                idEmployee = emp.Id,
                                emp.Name,
                                emp.IdBranch,
                                check.TimeStamp,
                                check.MinuteDiscount,
                                check.Type,
                                check.Valid
                            })
                        .Where(e => e.IdBranch == branch.Id)
                        .OrderByDescending(e => e.TimeStamp)
                        .AsNoTracking()
                        .ToListAsync<object>();

                    result.AddRange(checks);
                }

                return result;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }

    public async Task<List<object>> ChecksByEmployee(int idEmployee, DateTime start, DateTime end)
    {
        try
        {
            var adjustedEnd = end.AddDays(1);
            return await _context.EmployeesxChecks
                .Where(e => e.IdEmployee == idEmployee && 
                            e.TimeStamp >= start &&
                            e.TimeStamp <= adjustedEnd && 
                            e.Active == true)
                .Join(
                    _context.Employees,
                    check => check.IdEmployee,
                    emp => emp.Id,
                    (check, emp) => new
                    {
                        check.Id,
                        IdEmployee = check.IdEmployee,
                        EmployeeName = emp.Name,
                        IdBranch = emp.IdBranch,
                        Date = check.TimeStamp.Date,
                        CheckTime = check.TimeStamp.TimeOfDay,
                        ModifiedCheckTime = check.TimeStampBackup.HasValue ? check.TimeStampBackup.Value.TimeOfDay : (TimeSpan?)null,
                        check.Type,
                        check.Valid,
                        check.MinuteDiscount,
                        check.MinuteDiscountBackup,
                        check.ByTimeClock,
                        check.Edited,
                        check.EditedBy,
                        check.IdReason,
                        check.Holiday,
                        check.Comments,
                        check.Active,
                        TimeStamp = check.TimeStamp,
                        check.TimeStampBackup,
                        check.AdjustedTimeBySystem,
                        RealDateBySystem = check.RealTimeBySystem.HasValue ? check.RealTimeBySystem.Value.Date : check.AdjustedTimeBySystem.Value.Date,
                        RealHourBySystem = check.RealTimeBySystem.HasValue ? check.RealTimeBySystem.Value.TimeOfDay : check.AdjustedTimeBySystem.Value.TimeOfDay,
                        
                    })
                .OrderByDescending(e => e.TimeStamp)
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }

    public async Task Save(EmployeesxCheckInsOuts employeesxCheckInsOuts)
    {
        try
        {
            _context.EmployeesxChecks.Add(employeesxCheckInsOuts);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving info");
            throw;
        }
    }

    public async Task<Dictionary<string, object>> IncidentsByEmployee(int idEmployee, DateTime start, DateTime end)
    {
        try
        {
            var adjustedEnd = end.AddDays(1);
            var checks = await _context.EmployeesxChecks
                .Where(e => e.IdEmployee == idEmployee && e.TimeStamp >= start && e.TimeStamp <= adjustedEnd &&
                            e.Active == true)
                .OrderBy(e => e.TimeStamp)
                .AsNoTracking()
                .ToListAsync().ConfigureAwait(false);

            var incidents = new List<object>();
            DateTime? lastIn = null;
            int pendingOuts = 0;
            decimal totalHours = 0;
            
            decimal totalDiscountHours = 0;
            decimal adjustedHours = 0;
            int delays = 0;


            // Calculate total discount minutes and convert to hours
            totalDiscountHours = checks.Where(c => c.MinuteDiscount.HasValue)
                .Sum(c => c.MinuteDiscount.Value) / 60.0m;

            int validInCount = checks.Count(c => c.Valid && c.Type == "IN");
            int validOutCount = checks.Count(c => c.Valid && c.Type == "OUT");
            delays = Math.Max(0, validInCount - validOutCount);

            // Spanish day names mapping
            var spanishDays = new Dictionary<DayOfWeek, string>
            {
                { DayOfWeek.Monday, "Lunes" },
                { DayOfWeek.Tuesday, "Martes" },
                { DayOfWeek.Wednesday, "Miércoles" },
                { DayOfWeek.Thursday, "Jueves" },
                { DayOfWeek.Friday, "Viernes" },
                { DayOfWeek.Saturday, "Sábado" },
                { DayOfWeek.Sunday, "Domingo" }
            };

            // Count absences
            var today = DateTime.Today;
            var endDate = adjustedEnd.Date > today ? today : adjustedEnd.Date;

            /* for (var date = start.Date; date < endDate.Date; date = date.AddDays(1))
            {
                var hasChecks = checks.Any(c => c.TimeStamp.Date == date &&
                                                ((c.Type == "IN" && c.Valid) || (c.Type == "OUT" && c.Valid)));

                if (!hasChecks)
                {
                    var dayOfWeek = spanishDays[date.DayOfWeek];
                    var isRestDay = await _context.EmployeesXClocks
                        .Where(e => e.IdEmployee == idEmployee && e.Day == dayOfWeek)
                        .Select(e => e.Enabled)
                        .FirstOrDefaultAsync();

                    if (isRestDay)
                    {
                        absences++;
                    }
                }
            } */
            decimal absences = 0;
            for (var date = start.Date; date < endDate.Date; date = date.AddDays(1))
            {
                if (await ShouldCountAsAbsence(idEmployee, date, checks))
                {
                    absences++;
                    //_logger.LogInformation($"/+/+/+/+/+/+/+/+/+/+/+/+/+/Absence detected for Employee ID: {idEmployee} on {date} on {absences++}");
                }
            }
            int lastInDiscrepance = 0;
            foreach (var check in checks)
            {
                var time = check.RealTimeBySystem ?? check.AdjustedTimeBySystem;
               
                if (check.Type == "IN")
                {
                    lastIn = time;
                    lastInDiscrepance = (check.AllowDiscrepance == true && check.TimeDiscrepance.HasValue && check.TimeDiscrepance.Value > 0)
                        ? check.TimeDiscrepance.Value
                        : 0;
                }
                else if (check.Type == "OUT" && check.Valid)
                {

                    var outTime = time ?? check.TimeStamp;
                    var hours = (outTime - lastIn.Value).TotalHours;

                    // Suma discrepancia de la entrada (si la hubo)
                    if (lastInDiscrepance > 0)
                    {
                        hours += lastInDiscrepance / 60.0;
                    }

                    // Suma discrepancia de la salida (si la hay)
                    if (check.AllowDiscrepance == true && check.TimeDiscrepance.HasValue && check.TimeDiscrepance.Value > 0)
                    {
                        hours += check.TimeDiscrepance.Value / 60.0;
                    }

                    totalHours += (decimal)hours;
                    lastIn = null;
                    lastInDiscrepance = 0;
                }
            }
            
            var timeDiscrepanceSum = checks
                        .Where(c => c.TimeDiscrepance.HasValue &&
                                    (c.AllowDiscrepance == null || c.AllowDiscrepance == false))
                        .Sum(c => c.TimeDiscrepance.Value) / 60.0m;

                    totalDiscountHours = timeDiscrepanceSum;
                    decimal holidaySum = 0;
                    DateTime? lastHolidayIn = null;

                    foreach (var check in checks)
                    {
                        if (check.Holiday == true)
                        {
                            if (check.Type == "IN")
                            {
                                lastHolidayIn = check.TimeStamp;
                            }
                            else if (check.Type == "OUT" && lastHolidayIn.HasValue)
                            {
                                holidaySum += (decimal)(check.TimeStamp - lastHolidayIn.Value).TotalHours;
                                lastHolidayIn = null;
                            }
                        }
                    }

              var holidayCount = checks
                    .Where(c => c.Holiday == true)
                    .Select(c => c.TimeStamp.Date)
                    .Distinct()
                    .Count();
                adjustedHours = Math.Max(0, totalHours + holidaySum);

            var result = new Dictionary<string, object>
            {
                { "IdEmployee", idEmployee },
                { "PendingOuts", pendingOuts },
                { "totalHours", Math.Round(totalHours, 2) },   // Se podría borrar aquí
                { "Hours", Math.Round(adjustedHours, 2) },
                { "Absence", absences },
                { "Delays", delays },
                { "DiscountHours", Math.Round(totalDiscountHours, 2) }
            };
            var logContent = string.Join(", ", result.Select(kv => $"{kv.Key}: {kv.Value}"));
            _logger.LogInformation($"------------------------+++Employee ID: {idEmployee} - {logContent}");
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info");
            throw;
        }
    }
    
public async Task<List<object>> IncidentsByCompany(int idBranch)
{
    try
    {
        var incidents = new List<object>();
        List<BranchesApiData> branches;

        if (idBranch >= 0)
        {
            branches = new List<BranchesApiData>
            {
                new BranchesApiData { Id = idBranch, Name = "Branch" }
            };
        }
        else
        {
            branches = await _context.Employeexbranchs
                .Where(e => e.IdRoot == -idBranch)
                .Select(e => new BranchesApiData
                {
                    Id = e.IdBranches,
                    Name = e.Namebranch
                })
                .Distinct()
                .OrderBy(e => e.Name)
                .AsNoTracking()
                .ToListAsync();
        }

        foreach (var branch in branches)
        {
            var blocks = await _context.IdBlockPeriods
                .Where(p => p.IdBranch == branch.Id)
                .OrderByDescending(p => p.Id)
                .AsNoTracking()
                .ToListAsync();

            foreach (var block in blocks)
            {
                var effectiveStart = block.StartDate;
                var effectiveEnd = block.EndDate;

                var employees = await _context.Employees
                    .Where(e => e.IdBranch == branch.Id && e.Active == true)
                    .Select(e => new { e.Id, e.Name, e.BaseHours })
                    .OrderBy(e => e.Name)
                    .ToListAsync();

                foreach (var emp in employees)
                {
                    var checks = await _context.EmployeesxChecks // <-- Usa aquí el nombre real de tu tabla
                        .Where(c => c.IdEmployee == emp.Id &&
                                    c.TimeStamp.Date >= effectiveStart.Date &&
                                    c.TimeStamp.Date <= effectiveEnd.Date)
                        .OrderBy(c => c.TimeStamp)
                        .AsNoTracking()
                        .ToListAsync();

                    int absences = 0, delays = 0, pendingOuts = 0;
                    decimal totalHours = 0, totalDiscountHours = 0, adjustedHours = 0;
                    DateTime? lastIn = null;
                    decimal horalista = 0;
                    int lastInDiscrepance = 0;
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("America/Mexico_City");
                    var now = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                    var today = now.Date.AddDays(-1);

                    // Comparar y ajustar la fecha final
                    var endDate = effectiveEnd.Date >= today ? today : effectiveEnd.Date;
                    _logger.LogInformation($"-------------------------------------------------start{effectiveStart.Date} Effective End: {effectiveEnd.Date}, Today: {today}, Adjusted End Date: {endDate}");
                    // Iterar desde effectiveStart hasta la nueva fecha ajustada (endDate)
                    for (var date = effectiveStart.Date; date <= endDate; date = date.AddDays(1))
                    {
                        if (await ShouldCountAsAbsence(emp.Id, date, checks))
                        {
                                
                            //_logger.LogInformation($"///////////////////////////////Absence detected for Employee ID: {emp.Id} on {allAreHolidays}");
                            absences++;
                            _logger.LogInformation($"///////////////////////////////Absence detected for Employee ID: {emp.Id} on {date}");
                        }
                    }
                    
                    foreach (var check in checks)
                    {
                        var time = check.RealTimeBySystem ?? check.AdjustedTimeBySystem;
                    
                        if (check.Type == "IN")
                        {
                            lastIn = time;
                            lastInDiscrepance = (check.AllowDiscrepance == true && check.TimeDiscrepance.HasValue && check.TimeDiscrepance.Value > 0)
                                ? check.TimeDiscrepance.Value
                                : 0;
                        }
                        else if (check.Type == "OUT" && check.Valid && lastIn.HasValue)
                        {
                                var outTime = time ?? check.TimeStamp;
                            var hours = (outTime - lastIn.Value).TotalHours;
                    
                            // Suma discrepancia de la entrada (si la hubo)
                            if (lastInDiscrepance > 0)
                            {
                                hours += lastInDiscrepance / 60.0;
                            }
                    
                            // Suma discrepancia de la salida (si la hay)
                            if (check.AllowDiscrepance == true && check.TimeDiscrepance.HasValue && check.TimeDiscrepance.Value > 0)
                            {
                                hours += check.TimeDiscrepance.Value / 60.0;
                            }
                    
                            totalHours += (decimal)hours;
                            lastIn = null;
                            lastInDiscrepance = 0;
                        }
                    }

                    var timeDiscrepanceSum = checks
                        .Where(c => c.TimeDiscrepance.HasValue &&
                                    (c.AllowDiscrepance == null || c.AllowDiscrepance == false))
                        .Sum(c => c.TimeDiscrepance.Value) / 60.0m;

                    totalDiscountHours = timeDiscrepanceSum;
                    decimal holidaySum = 0;
                    DateTime? lastHolidayIn = null;

                    foreach (var check in checks)
                    {
                        if (check.Holiday == true)
                        {
                            if (check.Type == "IN")
                            {
                                lastHolidayIn = check.TimeStamp;
                            }
                            else if (check.Type == "OUT" && lastHolidayIn.HasValue)
                            {
                                holidaySum += (decimal)(check.TimeStamp - lastHolidayIn.Value).TotalHours;
                                lastHolidayIn = null;
                            }
                        }
                    }
                    int validInCount = checks.Count(c => c.Valid && c.Type == "IN");
                    int validOutCount = checks.Count(c => c.Valid && c.Type == "OUT");
                    pendingOuts = Math.Max(0, validInCount - validOutCount);

                    var holidayCount = checks
                        .Where(c => c.Holiday == true)
                        .Select(c => c.TimeStamp.Date)
                        .Distinct()
                        .Count();
                    var BaseHours = await _employeesxClockService.GetEmployeeTotalHoursByDateRange(effectiveStart, effectiveEnd , emp.Id);
                    adjustedHours = Math.Max(0, totalHours + holidaySum);
                    if(adjustedHours > BaseHours )
                    {
                        horalista = BaseHours; // Si las horas ajustadas son mayores que las horas base, se usa las horas base
                    }else{
                        horalista = adjustedHours;  
                    }
                    Console.WriteLine($"*********************** Adjusted Hours: {adjustedHours} for horas base: {BaseHours} ***********************");
                    var specialExtraHours = await CalculateSpecialExtraHours(emp.Id, effectiveStart, effectiveEnd);

                    incidents.Add(new
                    {
                        IdBranch = branch.Id,
                        NameBranch = branch.Name,
                        IdBlockPeriod = block.BlockPeriodCode,
                        IdEmployee = emp.Id,
                        NameEmployee = emp.Name,
                        BaseHours,
                        PendingOuts = pendingOuts,
                        TotalHours = Math.Round(totalHours, 2),
                        TimeDiscrepanceSum = Math.Round(timeDiscrepanceSum, 2),
                        HolidaySum = Math.Round(holidaySum, 2),
                        Hours = Math.Round(adjustedHours, 2),
                        HoursWithMinutes = FormatHoursAndMinutes(horalista),
                        ExtraHours = Math.Max(0, adjustedHours - BaseHours),
                        ExtraHoursWithMinutes = FormatHoursAndMinutes(Math.Max(0, adjustedHours - BaseHours)),
                        SpecialExtraHours = specialExtraHours,
                        Holidays = holidayCount,
                        Absences = absences,
                        Delays = delays,
                        DiscountHours = Math.Round(totalDiscountHours, 2),
                        DiscountHoursWithMinutes = FormatHoursAndMinutes(totalDiscountHours),
                        PeriodStart = effectiveStart.Date,
                        PeriodEnd = effectiveEnd.Date
                    });
                }
            }
        }

        return incidents;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error retrieving info for Branch ID {Id}", idBranch);
        throw;
    }
}



    public async Task<EmployeesxCheckInsOuts?> Update(int id, EmployeesxCheckInsOuts employeesxCheckInsOuts)
    {
        var existingCheck = await _context.EmployeesxChecks.FindAsync(id);
        if (existingCheck == null)
        {
            _logger.LogWarning("Attempted to update non-existent check with ID {Id}", id);
            return null;
        }

        try
        {
            existingCheck.IdEmployee = employeesxCheckInsOuts.IdEmployee;
            existingCheck.TimeStamp = employeesxCheckInsOuts.TimeStamp;
            existingCheck.TimeStampBackup = employeesxCheckInsOuts.TimeStampBackup;
            existingCheck.Type = employeesxCheckInsOuts.Type;
            existingCheck.Valid = employeesxCheckInsOuts.Valid;
            existingCheck.MinuteDiscount = employeesxCheckInsOuts.MinuteDiscount;
            existingCheck.MinuteDiscountBackup = employeesxCheckInsOuts.MinuteDiscountBackup;
            existingCheck.Edited = employeesxCheckInsOuts.Edited;
            existingCheck.ByTimeClock = employeesxCheckInsOuts.ByTimeClock;
            existingCheck.AdjustedTimeBySystem = employeesxCheckInsOuts.AdjustedTimeBySystem;
            existingCheck.RealTimeBySystem = employeesxCheckInsOuts.RealTimeBySystem;
            existingCheck.EditedBy = employeesxCheckInsOuts.EditedBy;
            existingCheck.IdReason = employeesxCheckInsOuts.IdReason;
            existingCheck.Holiday = employeesxCheckInsOuts.Holiday;
            existingCheck.Comments = employeesxCheckInsOuts.Comments;
            existingCheck.Active = employeesxCheckInsOuts.Active;

            await _context.SaveChangesAsync();
            return employeesxCheckInsOuts;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating check with ID {Id}", id);
            throw;
        }
    }
    
    // Función auxiliar para verificar ausencias
    private async Task<bool> ShouldCountAsAbsence(int employeeId, DateTime date, List<EmployeesxCheckInsOuts> checks)
{
    var dayOfWeek = date.DayOfWeek;
    var spanishDay = new Dictionary<DayOfWeek, string>
    {
        { DayOfWeek.Monday, "Lunes" },
        { DayOfWeek.Tuesday, "Martes" },
        { DayOfWeek.Wednesday, "Miércoles" },
        { DayOfWeek.Thursday, "Jueves" },
        { DayOfWeek.Friday, "Viernes" },
        { DayOfWeek.Saturday, "Sábado" },
        { DayOfWeek.Sunday, "Domingo" }
    }[dayOfWeek];

    var clockConfig = await _context.EmployeesXClocks
        .FirstOrDefaultAsync(e => e.IdEmployee == employeeId && 
                                  e.Day.Equals(spanishDay) && 
                                  e.Active && 
                                  e.Enabled);

    // Si no hay horario activo, no se cuenta como falta
    if (clockConfig == null)
        return false;

    // Asegurar comparación correcta de fechas
    var dateOnly = date.Date;

    var checksForDay = checks
        .Where(c => c.TimeStamp.Date == dateOnly &&
                    c.Valid &&
                    c.Type.Trim().ToUpper() == "IN" &&
                    c.Holiday == false)
        .Count();

    var anyWorkingDay = checks.Any(c => c.TimeStamp.Date == dateOnly && c.Holiday == true);

    if (checksForDay == 0 && !anyWorkingDay)
        return true;

    return false;
}

    
    public async Task<List<EmployeesxDiscrepancesChecksView>> Discrepances(int idBranch)
{
    try
    {
        if (idBranch >= 0)
        {
            var hrConfig = await _context.HRManagement
                .FirstOrDefaultAsync(h => h.IdBranch == idBranch && h.Active);
                
            if (hrConfig == null)
            {
                _logger.LogWarning($"No se encontró configuración HR para la sucursal {idBranch}");
                return new List<EmployeesxDiscrepancesChecksView>();
            }

            var toleranceInMinutes = hrConfig.SettingToleranceTime ?? 0;

            return await _context.EmployeesxDiscrepancesChecksViews
                .Where(c => c.IdBranch == idBranch && 
                           (c.TimeDiscrepance > toleranceInMinutes || c.TimeDiscrepance < -toleranceInMinutes))
                .OrderBy(c => c.AllowDiscrepance.HasValue)
                .ThenByDescending(c => c.DateStamp)
                .ThenByDescending(c => c.TimeStampOnly)
                .AsNoTracking()
                .ToListAsync();
        }
        else
        {
            var branches = await _branchesService.GetBranchesData(-idBranch);
            var result = new List<EmployeesxDiscrepancesChecksView>();

            foreach (var branch in branches)
            {
                var hrConfig = await _context.HRManagement
                    .FirstOrDefaultAsync(h => h.IdBranch == branch.Id && h.Active);

                if (hrConfig == null)
                {
                    _logger.LogWarning($"No se encontró configuración HR para la sucursal {branch.Id}");
                    continue;
                }

                var toleranceInMinutes = hrConfig.SettingToleranceTime ?? 0;

                var branchDiscrepances = await _context.EmployeesxDiscrepancesChecksViews
                    .Where(c => c.IdBranch == branch.Id &&
                               (c.TimeDiscrepance > toleranceInMinutes || c.TimeDiscrepance < -toleranceInMinutes))
                    .OrderBy(c => c.AllowDiscrepance.HasValue)
                    .ThenByDescending(c => c.DateStamp)
                    .ThenByDescending(c => c.TimeStampOnly)
                    .AsNoTracking()
                    .ToListAsync();

                result.AddRange(branchDiscrepances);
            }

            return result;
        }
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error recuperando discrepancias para la sucursal {IdBranch}", idBranch);
        throw;
    }
}

    private (DateTime effectiveStart, DateTime effectiveEnd) CalculateEffectiveDates(HRManagement hrConfig)
    {
        var today = DateTime.Today;
        var currentDayOfWeek = today.DayOfWeek;

        var dayMapping = new Dictionary<string, DayOfWeek>
        {
            { "Lunes", DayOfWeek.Monday },
            { "Martes", DayOfWeek.Tuesday },
            { "Miércoles", DayOfWeek.Wednesday },
            { "Jueves", DayOfWeek.Thursday },
            { "Viernes", DayOfWeek.Friday },
            { "Sábado", DayOfWeek.Saturday },
            { "Domingo", DayOfWeek.Sunday }
        };

        var startDayOfWeek = dayMapping[hrConfig.StartDay];

        if (currentDayOfWeek == startDayOfWeek)
        {
            return (today, today.AddDays(6));
        }
        else
        {
            int daysToSubtract = (int)currentDayOfWeek - (int)startDayOfWeek;
            if (daysToSubtract < 0) daysToSubtract += 7;

            var effectiveStart = today.AddDays(-daysToSubtract);
            return (effectiveStart, effectiveStart.AddDays(6));
        }
    }
    
    public async Task<EmployeesxCheckInsOuts?> UpdateDiscrepance(int id, UpdateDiscrepanceDTO updateDto)
    {
        var existingCheck = await _context.EmployeesxChecks
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id);

        if (existingCheck == null)
        {
            _logger.LogWarning("Registro no encontrado con ID {Id}", id);
            return null;
        }

        try
        {
            // Solo actualiza los campos específicos de la discrepancia
            existingCheck.AllowDiscrepance = updateDto.AllowDiscrepance;
            existingCheck.DiscrepanceAllowedApprovedBy = updateDto.DiscrepanceAllowedApprovedBy;
            existingCheck.Type = updateDto.Type;
            existingCheck.DiscrepanceAllowedReason = updateDto.DiscrepanceAllowedReason;

            _context.EmployeesxChecks.Update(existingCheck);
            await _context.SaveChangesAsync();
            return existingCheck;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error actualizando discrepancia para el registro {Id}", id);
            throw;
        }
    }
    
    private string FormatHoursAndMinutes(decimal hours)
    {
        int totalMinutes = (int)(hours * 60);
        int wholeHours = totalMinutes / 60;
        int minutes = totalMinutes % 60;
        return $"{wholeHours}:{minutes:00}";
    }
}

public interface IEmployeesXCheckInsOutsService
{
    Task<List<object>> AllChecks(int idBranch);
    Task<List<object>> ChecksByEmployee(int idEmployee, DateTime start, DateTime end);
    Task<List<object>> ChecksByBranch(int idBranch, DateTime start, DateTime end);
    Task Save(EmployeesxCheckInsOuts employeesxCheckInsOuts);
    Task<EmployeesxCheckInsOuts?> Update(int id, EmployeesxCheckInsOuts employeesxCheckInsOuts);
    Task<Dictionary<string, object>> IncidentsByEmployee(int idEmployee, DateTime start, DateTime end);
    Task<List<object>> IncidentsByCompany(int idBranch);
    Task<List<EmployeesxDiscrepancesChecksView>> Discrepances(int idBranch);
    Task<EmployeesxCheckInsOuts?> UpdateDiscrepance(int id, UpdateDiscrepanceDTO updateDto);
}