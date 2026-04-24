using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;
using ClosedXML.Excel;
using SMP.Models.TD;
using System.IO;
using Microsoft.Data.SqlClient;
using System;

namespace SMP.Services
{
    public class DatosXFechas : IDatosXFechas
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<DatosXFechas> _logger;
        private readonly ILogbookService _logbookService;

        public DatosXFechas(DbSmpContext dbContext, ILogger<DatosXFechas> logger, ILogbookService logbookService)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _logbookService = logbookService ?? throw new ArgumentNullException(nameof(logbookService));
        }
        public async Task<List<object>> GetOTs(int idCompany, DateTime? startDate, DateTime? endDate)
        {
            try
            {
                _logger.LogInformation($"Retrieving OTs for company {idCompany} between {startDate} and {endDate}");
                var result = await _context.OTs
                    .Where(c => c.Active == true && 
                                (!startDate.HasValue || c.RegisterDate >= startDate.Value) &&
                                (!endDate.HasValue || c.RegisterDate <= endDate.Value))
                    .OrderByDescending(c => c.RegisterDate)

                    .AsNoTracking()
                    .ToListAsync();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No records found");
                    return result.Cast<object>().ToList();
                }

                _logger.LogInformation($"Records found {result.Count}");
                return result.Cast<object>().ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                throw;
            }
        }
        public async Task<List<object>> GetDailyReports(int idCompany, DateTime? startDate, DateTime? endDate)
        {
           try
            {
                _logger.LogInformation($"Retrieving Daily Reports for company {idCompany} between {startDate} and {endDate}");
                var result = await _context.LogbookDetallada
                    .Where(c => 
                                (!startDate.HasValue || c.Date >= startDate.Value) &&
                                (!endDate.HasValue || c.Date <= endDate.Value))
                    .OrderByDescending(c => c.Date)
                    .AsNoTracking()
                    .ToListAsync();

                if (result.Count == 0)
                {
                    _logger.LogInformation("No records found");
                    return result.Cast<object>().ToList();
                }

                _logger.LogInformation($"Records found {result.Count}");
                return result.Cast<object>().ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                throw;
            }
        }
    }

    public interface IDatosXFechas
    {
        Task<List<object>> GetOTs(int idCompany, DateTime? startDate, DateTime? endDate);
        Task<List<object>> GetDailyReports(int idCompany, DateTime? startDate, DateTime? endDate);
        }
}