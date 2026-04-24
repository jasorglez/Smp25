using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class TimeInactiveService : ITimeInactiveService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<TimeInactiveService> _logger;

        public TimeInactiveService(DbSmpContext dbContext, ILogger<TimeInactiveService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetTimeInactives(int idArea)
        {
            try
            {
                return await _context.Timeinactives
                    .Where(t => t.IdArea == idArea && t.Active)
                    .Select(t => new
                    {
                        t.Id,
                        t.Date,
                        t.IdArea,
                        t.IdClasification,
                        t.TimeStart,
                        t.TimeEnd,
                        t.Total,
                        t.IdProgram,
                        t.Cause
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TimeInactives for area {IdArea}", idArea);
                throw;
            }
        }

        public async Task<List<object>> totalxcauses()
        {

            var result = await (
                from t in _context.Timeinactives
                where t.Active == true
                group t by t.Cause into g
                select new
                {
                    cause = g.Key,
                    totalcause = g.Count(),
                    
                })
                .OrderBy(x => x.cause)
                .AsNoTracking()
                .ToListAsync<object>();

            return result;
        }

        public async Task<List<object>> GetByReporte(int idReporte)
        {
            try
            {
                return await _context.Timeinactives
                    .Where(t => t.IdReporte == idReporte && t.Active)
                    .Select(t => new
                    {
                        t.Id, t.IdReporte, t.IdProject, t.Date,
                        t.IdArea, t.IdClasification,
                        t.TimeStart, t.TimeEnd, t.Total,
                        t.Personal, t.IdProgram, t.Cause
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TimeInactives for reporte {IdReporte}", idReporte);
                throw;
            }
        }

        public async Task<List<object>> GetTimeInactivesForProject(int idProject, DateTime date)
        {
            try
            {
                return await _context.Timeinactives
                    .Where(t => t.IdProject == idProject && t.Date==date && t.Active )
                    .Select(t => new
                    {
                        t.Id, t.Date,
                        t.IdArea, t.IdProject,
                        t.IdClasification,
                        t.TimeStart,
                        t.TimeEnd,
                        t.Total,
                        t.IdProgram,
                        t.Cause
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TimeInactives for date {idProject}", idProject);
                throw;
            }
        }

        public async Task Save(Timeinactive timeInactive)
        {
            try
            {
                timeInactive.Total = CalculateTotal(timeInactive);
                _context.Timeinactives.Add(timeInactive);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving TimeInactive");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving TimeInactive");
                throw;
            }
        }

        public async Task<Timeinactive?> Update(int id, Timeinactive timeInactive)
        {
            var existingTimeInactive = await _context.Timeinactives.FindAsync(id);
            if (existingTimeInactive == null)
            {
                _logger.LogWarning("Attempted to update non-existent TimeInactive with ID {Id}", id);
                return null;
            }

            try
            {
                existingTimeInactive.IdReporte       = timeInactive.IdReporte;
                existingTimeInactive.IdProject       = timeInactive.IdProject;
                existingTimeInactive.Date            = timeInactive.Date;
                existingTimeInactive.IdArea          = timeInactive.IdArea;
                existingTimeInactive.IdClasification = timeInactive.IdClasification;
                existingTimeInactive.TimeStart       = timeInactive.TimeStart;
                existingTimeInactive.TimeEnd         = timeInactive.TimeEnd;
                existingTimeInactive.IdProgram       = timeInactive.IdProgram;
                existingTimeInactive.Cause           = timeInactive.Cause;
                existingTimeInactive.Personal        = timeInactive.Personal;
                existingTimeInactive.Total           = CalculateTotal(timeInactive);

                await _context.SaveChangesAsync();
                return existingTimeInactive;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating TimeInactive with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating TimeInactive with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingTimeInactive = await _context.Timeinactives.FindAsync(id);
            if (existingTimeInactive == null)
            {
                _logger.LogWarning("Attempted to delete non-existent TimeInactive with ID {Id}", id);
                return false;
            }

            try
            {
                existingTimeInactive.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting TimeInactive with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting TimeInactive with ID {Id}", id);
                throw;
            }
        }
    

        private static decimal CalculateTotal(Timeinactive t)
        {
            if (t.TimeStart == null || t.TimeEnd == null) return 0;
            var hours = (t.TimeEnd.Value - t.TimeStart.Value).TotalHours;
            if (hours < 0) hours = 0;
            return Math.Round((decimal)hours * (t.Personal ?? 1), 2);
        }
    }

    public interface ITimeInactiveService
    {
        Task<List<object>> GetTimeInactives(int idArea);
        Task<List<object>> totalxcauses();
        Task<List<object>> GetTimeInactivesForProject(int idProject, DateTime date);
        Task<List<object>> GetByReporte(int idReporte);
        Task Save(Timeinactive timeInactive);
        Task<Timeinactive?> Update(int id, Timeinactive timeInactive);
        Task<bool> Delete(int id);
    }
}
