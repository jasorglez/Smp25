
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace MicroServicioTracking.Services
{
    public class CourserInfoService : ICourserInfoService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<CourserInfoService> _logger;

        public CourserInfoService(DbTrackingContext context, ILogger<CourserInfoService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<CourserInfo>> GetAll()
        {
            try
            {
                return await _context.CourserInfo
                    .Where(c => c.Active)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all CourserInfo");
                throw;
            }
        }

        public async Task Save(CourserInfo courserInfo)
        {
            try
            {
                _context.CourserInfo.Add(courserInfo);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving CourserInfo");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving CourserInfo");
                throw;
            }
        }

        public async Task<CourserInfo?> Update(int id, CourserInfo courserInfo)
        {
            var existingCourserInfo = await _context.CourserInfo.FindAsync(id);
            if (existingCourserInfo == null)
            {
                _logger.LogWarning("Attempted to update non-existent courserInfo with ID {Id}", id);
                return null;
            }

            try
            {
                existingCourserInfo.Curso = courserInfo.Curso;
                existingCourserInfo.Escolaridad = courserInfo.Escolaridad;
                existingCourserInfo.Institucion = courserInfo.Institucion;
                existingCourserInfo.Nombre = courserInfo.Nombre;
                existingCourserInfo.Contacto = courserInfo.Contacto;
                existingCourserInfo.Atendido = courserInfo.Atendido;
                existingCourserInfo.Active = courserInfo.Active;
                await _context.SaveChangesAsync();
                return existingCourserInfo;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Bank with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Bank with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingCourserInfo = await _context.CourserInfo.FindAsync(id);
            if (existingCourserInfo == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Bank with ID {Id}", id);
                return false;
            }

            try
            {
                existingCourserInfo.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Bank with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Bank with ID {Id}", id);
                throw;
            }
        }
    }

    public interface ICourserInfoService
    {
        Task<List<CourserInfo>> GetAll();
        Task Save(CourserInfo courserInfo);
        Task<CourserInfo?> Update(int id, CourserInfo courserInfo);
        Task<bool> Delete(int id);
    }
}
