
using DocumentFormat.OpenXml.Office2016.Drawing.ChartDrawing;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SMP.Hubs;
using SMP.Models;
using SMP.Models.context;
using static SMP.Services.DailyReportService;
using System;

namespace SMP.Services
{
    public class DailyReportService : IDailyReportService
    {
        private readonly DbSmpContext _context;
        private readonly IHubContext<StorageHub> _hubContext;
        private readonly ILogger<DailyReportService> _logger;


        public DailyReportService(DbSmpContext context, ILogger<DailyReportService> logger, IHubContext<StorageHub> hubContext)
        {                       
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _hubContext = hubContext;
        }

        public async Task<List<DailyReport>> GetXOT(int ot)
        {
            try
            {
                return await _context.DailyReports
                .Where(r => r.Active && r.IdOt == ot)
                .AsNoTracking()
                .OrderByDescending(r => r.Date)
                .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OT,  ot");
                throw;
            }

        }

        public async Task<List<DailyReport>> GetXProject(int project)
        {
            try
            {
                return await _context.DailyReports
                .Where(r => r.Active && r.IdProject == project)
                .AsNoTracking()
                .OrderByDescending(r => r.Date)
                .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OT,  ot");
                throw;
            }

        }

        public async Task<List<object>> GetReportCostSummary(int reportId)
        {
            try
            {
                var result = await (from r in _context.DailyReports
                                    join l in _context.Logbooks on r.Id equals l.IdReporte
                                    join w in _context.Workprograms on l.IdResource equals w.Id
                                    join o in _context.OTs on r.IdOt equals o.Id
                                    where l.TypeNote == "CONCEPT" && r.Id == reportId 
                                    group new { r, l, w, o } by new { r.Date, o.OtNumber } into g
                                    orderby g.Key.Date, g.Key.OtNumber
                                    select new
                                    {
                                        date = g.Key.Date,
                                        ot_number = g.Key.OtNumber,
                                        total = g.Sum(x => x.w.CostMX * (x.l.Validado == "PAGO" ? x.l.Quantity : 0))
                                    })
                                   .ToListAsync();

                return result.Cast<object>().ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving report cost summary for report ID: {ReportId}", reportId);
                throw;
            }
        }

        public async Task<decimal> GetResourceTotalQuantity(int idResource, DateTime startDate, DateTime endDate)
        {
            try
            {
                return await _context.Logbooks
                    .Where(l => l.IdResource == idResource
                             && l.Date >= startDate
                             && l.Date <= endDate)
                     .SumAsync(l => (decimal?)l.Quantity) ?? 0m;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error calculating total quantity for resource {idResource}");
                throw;
            }
        }

        public async Task<List<DailyReport>> GetXReport(int rep)
        {
            try
            {
                return await _context.DailyReports
                .Where(r => r.Active && r.Id == rep)
                .AsNoTracking()
                .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OT,  ot");
                throw;
            }

        }

        public async Task<DailyReport?> GetById(int id)
        {
            return await _context.DailyReports.FindAsync(id);
        }


        public async Task<DailyReport> Save(DailyReport report)
        {
            if (report == null)
                throw new ArgumentNullException(nameof(report));

            // Debe existir IdOt o IdProject válido
            if (report.IdOt <= 0 && (!report.IdProject.HasValue || report.IdProject.Value <= 0))
                throw new ArgumentException("IdOt o IdProject debe ser mayor a 0.", nameof(report));

            _logger.LogInformation("Saving new daily report: {@Report}", report);

            string[] allowedTypes = { "MATERIAL", "PERSONAL", "EQUIPMENT", "NOTE" };

            using var transaction = await _context.Database.BeginTransactionAsync();

            try
            {
                // 1️⃣ Obtener último reporte activo
                var lastReport = await _context.DailyReports
                    .Where(dr => dr.IdOt == report.IdOt && dr.Active)
                    .OrderByDescending(dr => dr.Date)
                    .FirstOrDefaultAsync();

                int? lastReportId = lastReport?.Id;

                // 2️⃣ Guardar nuevo reporte
                _context.DailyReports.Add(report);
                await _context.SaveChangesAsync();

                int newReportId = report.Id;
                List<Logbook> previousLogbooks = new();

                // 3️⃣ Obtener logbooks previos si existen
                if (lastReportId.HasValue)
                {
                    previousLogbooks = await _context.Logbooks
                        .Where(lb => lb.IdReporte == lastReportId.Value &&
                                     allowedTypes.Contains(lb.TypeNote))
                        .AsNoTracking()
                        .ToListAsync();

                    _logger.LogInformation("Found {Count} previous logbooks", previousLogbooks.Count);
                }

                // 4️⃣ Obtener proyecto asociado
                var projectId = await _context.OTs
                    .Where(o => o.Id == report.IdOt)
                    .Select(o => o.IdProject)
                    .FirstOrDefaultAsync();

                if (projectId.HasValue)
                {
                    int pid = projectId.Value;

                    var assignedPersonnel = await _context.PersonalByProyect
                        .Where(p => p.IdProyect == pid && p.Active)
                        .ToListAsync();

                    _logger.LogInformation("Found {Count} assigned personnel", assignedPersonnel.Count);

                    var cuadrilla = await _context.Projects
                        .Where(pr => pr.Id == pid && pr.Active == 1)
                        .Select(pr => pr.IdConsecutivo)
                        .FirstOrDefaultAsync();

                    string cuadrillaName = cuadrilla.HasValue
                        ? $"Cuadrilla {cuadrilla.Value}"
                        : "Cuadrilla";

                    // 5️⃣ Añadir PERSONAL faltante
                    foreach (var person in assignedPersonnel)
                    {
                        bool existsInPrevious = previousLogbooks.Any(lb =>
                            lb.IdResource == person.IdPersonal &&
                            lb.TypeNote == "PERSONAL");

                        if (!existsInPrevious)
                        {
                            previousLogbooks.Add(new Logbook
                            {
                                IdProject = pid,
                                IdOt = report.IdOt,
                                IdResource = person.IdPersonal,
                                IdReporte = newReportId,
                                Date = report.Date,
                                Timexnote = TimeSpan.Zero,
                                TypeNote = "PERSONAL",
                                Description = "Auto-añadido desde PersonalByProyect",
                                Quantity = 0,
                                ImageUrl = "SIN FOTO",
                                ImageAzure = "NO FILE",
                                Cuadrilla = cuadrillaName
                            });

                            _logger.LogInformation("Added personnel ID {Id}", person.IdPersonal);
                        }
                    }
                }

                // 6️⃣ Clonar logbooks al nuevo reporte
                if (previousLogbooks.Any())
                {
                    var newLogbooks = previousLogbooks.Select(lb => new Logbook
                    {
                        IdProject = lb.IdProject,
                        IdOt = lb.IdOt,
                        IdResource = lb.IdResource,
                        IdReporte = newReportId,
                        Date = report.Date,
                        Timexnote = lb.Timexnote,
                        TypeNote = lb.TypeNote,
                        Description = lb.Description,
                        Quantity = lb.Quantity,
                        ImageUrl = lb.ImageUrl,
                        Supervisor = lb.Supervisor,
                        ImageAzure = lb.ImageAzure,
                        Metadata = lb.Metadata,
                        Cuadrilla = lb.Cuadrilla,
                        Orden = lb.Orden
                    }).ToList();

                    _context.Logbooks.AddRange(newLogbooks);
                    await _context.SaveChangesAsync();

                    _logger.LogInformation(
                        "Copied {Count} logbooks to new DailyReport ID {NewId}",
                        newLogbooks.Count, newReportId
                    );
                }

                await transaction.CommitAsync();

                return report;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error saving DailyReport: {@Report}", report);
                throw;
            }
        }


        public async Task<bool> Update(int id, DailyReport report)
        {
            var existing = await _context.DailyReports.FindAsync(id);
            if (existing == null) return false;

            _context.Entry(existing).CurrentValues.SetValues(report);
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateTotalConcepts(int id, DailyReport report)
        {
            try
            {
                var existing = await _context.DailyReports.FindAsync(id);
                if (existing == null) return false;

                // Solo actualizar campos específicos en lugar de SetValues
                  existing.TotalPay = report.TotalPay;                              
                  await _context.SaveChangesAsync();
                  return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating DailyReport {Id}: {@Report}", id, report);
                throw;
            }
        }

        public async Task<object> GetReporteOtProject(int companyId, DateTime? startDate, DateTime? endDate) 
        {
            var otData = await (from r in _context.DailyReports
                                join l in _context.Logbooks on r.Id equals l.IdReporte
                                join w in _context.Workprograms on l.IdResource equals w.Id
                                join p in _context.Projects on w.IdProject equals p.Id
                                join o in _context.OTs on r.IdOt equals o.Id
                                join c in _context.Contracts on p.IdContrato equals c.Id
                                join b in _context.Branchs on c.IdBranch equals b.Id
                                where l.TypeNote == "CONCEPT" && r.TotalPay > 0 && b.IdCompany == companyId &&
                                (!startDate.HasValue || r.Date >= startDate) &&
                                (!endDate.HasValue || r.Date <= endDate)
                                group r by new { p.Name, o.OtNumber } into g
                                select new
                                {
                                    ProjectName = g.Key.Name,
                                    OtNumber = g.Key.OtNumber,
                                    TotalOt = g.Select(x => x.TotalPay).Distinct().Sum()
                                }).ToListAsync();

            // Calcular totales por proyecto
            var projectTotals = otData
                .GroupBy(x => x.ProjectName)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.TotalOt));

            // Combinar resultados
            var result = otData.Select(x => new
            {
                x.ProjectName,
                x.OtNumber,
                x.TotalOt,
                TotalProject = projectTotals[x.ProjectName]
            }).OrderBy(x => x.ProjectName).ToList();

            return result;
        }

        public async Task<bool> Delete(int id)
        {
            var report = await _context.DailyReports.FindAsync(id);
            if (report == null) return false;

            report.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateBitacoraCount(int id, string typeNote, int count)
        {
            var existing = await _context.DailyReports.FindAsync(id);
            if (existing == null) return false;

            switch (typeNote.ToUpper())
            {
                case "PERSONAL":  existing.Personal   = (short)count; break;
                case "MATERIAL":  existing.Material   = (short)count; break;
                case "EQUIPMENT": existing.Equipos    = (short)count; break;
                case "PHOTO":     existing.Fotos      = (short)count; break;
                case "VIDEO":     existing.Videos     = (short)count; break;
                case "CONCEPTO":   existing.Conceptos  = (short)count; break;
                case "NOTE":           existing.Notas      = (short)count; break;
                case "TIME_INACTIVE":  existing.Tiempos    = (short)count; break;
                default: return false;
            }

            await _context.SaveChangesAsync();
            return true;
        }
    }


        public interface IDailyReportService
        {
            Task<List<DailyReport>> GetXOT(int ot);
            Task<List<DailyReport>> GetXProject(int project);
            Task<object> GetReporteOtProject(int companyId, DateTime? startDate, DateTime? endDate);
            Task<List<object>> GetReportCostSummary(int reportId);
            Task<decimal> GetResourceTotalQuantity(int idResource, DateTime startDate, DateTime endDate);
            Task<DailyReport?> GetById(int id);
            Task<DailyReport> Save(DailyReport report);
            Task<bool> Update(int id, DailyReport report);
            Task<bool> UpdateTotalConcepts(int id, DailyReport report);
            Task<bool> Delete(int id);
            Task<bool> UpdateBitacoraCount(int id, string typeNote, int count);
        }

}
