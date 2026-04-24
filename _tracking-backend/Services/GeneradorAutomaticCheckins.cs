using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class GeneradorAutomaticCheckinsService : IGeneradorAutomaticCheckinsService
    {
        private readonly ILogger<GeneradorAutomaticCheckinsService> _logger;
        private readonly DbTrackingContext _context;

        public GeneradorAutomaticCheckinsService(ILogger<GeneradorAutomaticCheckinsService> logger, DbTrackingContext context)
        {
            _logger = logger;
            _context = context;
        }

        public async Task GenerateAutomaticFaltas()
        {

            var yesterday = DateTime.Today.AddDays(-1);
            string weekday = GetSpanishDay(yesterday.DayOfWeek);

            _logger.LogInformation("Iniciando proceso para fecha: {date}", yesterday.ToString("dd/MM/yyyy"));
            _logger.LogInformation("Día de la semana calculado: {day}", weekday);

            var employees = _context.Employees
                .Where(e => e.Active == true)
                .Select(e => new { e.Id, e.Name })
                .ToList();

            foreach (var emp in employees)
            {
                _logger.LogInformation("Procesando empleado: {id} - {name}", emp.Id, emp.Name);

                bool hasCheckins = _context.EmployeesxChecks
                    .Any(c =>
                        c.IdEmployee == emp.Id &&
                        c.TimeStamp.Date == yesterday &&
                        (c.Type == "IN" || c.Type == "OUT")
                    );

                if (!hasCheckins)
                {
                    _logger.LogInformation("Empleado {id} no tiene registros. Buscando horario...", emp.Id);

                    var schedule = _context.EmployeesXClocks
                        .Where(c => c.IdEmployee == emp.Id &&
                                    c.Day == weekday &&
                                    c.Enabled == true &&
                                    c.Active == true)
                        .Select(c => new { c.Entry1, c.Entry2, c.Exit1, c.Exit2 })
                        .FirstOrDefault();

                    if (schedule == null || (schedule.Entry1 == null && schedule.Entry2 == null &&
                                             schedule.Exit1 == null && schedule.Exit2 == null))
                    {
                        _logger.LogWarning("AVISO: No hay horario configurado para {day}", weekday);
                        continue;
                    }

                    InsertCheck(emp.Id, yesterday, schedule.Entry1, "IN");
                    InsertCheck(emp.Id, yesterday, schedule.Entry2, "IN");
                    InsertCheck(emp.Id, yesterday, schedule.Exit1, "OUT");
                    InsertCheck(emp.Id, yesterday, schedule.Exit2, "OUT");

                    _context.SaveChanges();
                }
                else
                {
                    _logger.LogInformation("Empleado {id} ya tiene registros. No se generan automáticos.", emp.Id);
                }
            }

            _logger.LogInformation("Proceso completado para todos los empleados activos. Fecha: {date}",
                yesterday.ToString("dd/MM/yyyy"));
        }

        private void InsertCheck(int employeeId, DateTime baseDate, TimeOnly? time, string type)
{
    if (time == null) return;

    var dateTime = new DateTime(
        baseDate.Year,
        baseDate.Month,
        baseDate.Day,
        time.Value.Hour,
        time.Value.Minute,
        0
    );

    _context.EmployeesxChecks.Add(new EmployeesxCheckInsOuts
    {
        IdEmployee = employeeId,
        TimeStamp = dateTime,
        AdjustedTimeBySystem = dateTime,
        Type = type,
        Valid = false,
        ByTimeClock = false
    });

    _logger.LogInformation("Registro creado: {type} {time}", type, time.Value.ToString("HH:mm"));
}


        private string GetSpanishDay(DayOfWeek day)
        {
            return day switch
            {
                DayOfWeek.Sunday => "Domingo",
                DayOfWeek.Monday => "Lunes",
                DayOfWeek.Tuesday => "Martes",
                DayOfWeek.Wednesday => "Miércoles",
                DayOfWeek.Thursday => "Jueves",
                DayOfWeek.Friday => "Viernes",
                DayOfWeek.Saturday => "Sábado",
                _ => throw new ArgumentOutOfRangeException(nameof(day), day, null)
            };
        }
    }
}

namespace MicroServicioTracking.Services
{
    public interface IGeneradorAutomaticCheckinsService
    {
        Task GenerateAutomaticFaltas();
    }
}