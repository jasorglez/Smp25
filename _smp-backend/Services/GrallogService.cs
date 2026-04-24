using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class GrallogService : IGrallogService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<GrallogService> _logger;

        public GrallogService(DbSmpContext dbContext, ILogger<GrallogService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GrallogsxProject(int idProject)
        {
            try
            {
                return await _context.Grallogs
                    .Where(g => g.IdProject == idProject && g.Active == true)
                    .Select(g => new
                    {
                        g.Id,
                        g.IdProject,
                        g.IdReporte,
                        g.Date,
                        g.IdLog,
                        g.Time,
                        g.Quantity,
                        g.Img,
                        g.Type
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Grallogs for project {IdProject}", idProject);
                throw;
            }
        }

        public async Task<List<object>> GrallogsxDate(DateTime datelog)
        {
            try
            {
                return await _context.Grallogs
                    .Where(g => g.Date == datelog && g.Active == true)
                    .Select(g => new
                    {
                        g.Id,
                        g.IdProject,
                        g.IdReporte,
                        g.Date,
                        g.IdLog,
                        g.Time,
                        g.Quantity,
                        g.Img,
                        g.Type
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Grallogs for project {Date}", datelog);
                throw;
            }
        }

        public async Task Save(Grallog grallog)
        {
            try
            {
                _context.Grallogs.Add(grallog);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Grallog");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Grallog");
                throw;
            }
        }

        public async Task<Grallog?> Update(int id, Grallog grallog)
        {
            var existingGrallog = await _context.Grallogs.FindAsync(id);
            if (existingGrallog == null)
            {
                _logger.LogWarning("Attempted to update non-existent Grallog with ID {Id}", id);
                return null;
            }

            try
            {
                existingGrallog.IdProject = grallog.IdProject;
                existingGrallog.IdReporte = grallog.IdReporte;
                existingGrallog.Date = grallog.Date;
                existingGrallog.IdLog = grallog.IdLog;
                existingGrallog.Time = grallog.Time;
                existingGrallog.Quantity = grallog.Quantity;
                existingGrallog.Img = grallog.Img;
                existingGrallog.Type = grallog.Type;

                await _context.SaveChangesAsync();
                return existingGrallog;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Grallog with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Grallog with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingGrallog = await _context.Grallogs.FindAsync(id);
            if (existingGrallog == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Grallog with ID {Id}", id);
                return false;
            }

            try
            {
                existingGrallog.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Grallog with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Grallog with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IGrallogService
    {
        Task<List<object>> GrallogsxProject(int idProject);
        Task<List<object>> GrallogsxDate(DateTime datelog);
        Task Save(Grallog grallog);
        Task<Grallog?> Update(int id, Grallog grallog);
        Task<bool> Delete(int id);
    }
}