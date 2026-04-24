using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class ClaveUnidadService : IClaveUnidadService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ClaveUnidadService> _logger;

        public ClaveUnidadService(DbSmpContext context, ILogger<ClaveUnidadService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetClaveUnidad()
        {
            try
            {
                return await _context.ClaveUnidads
                    .Where(c => c.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveUnidad");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.ClaveUnidads
                    .Where(c => c.Active)
                    .Select(c => new
                    {
                        c.Id,c.ClaveUnidadValue,
                        c.Nombre
                    })
                    .AsNoTracking()
                    .OrderBy(c => c.Nombre)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveUnidad fields");
                throw;
            }
        }

        public async Task<object> CreateClaveUnidad(ClaveUnidad claveUnidad)
        {
            try
            {
                _context.ClaveUnidads.Add(claveUnidad);
                await _context.SaveChangesAsync();
                return claveUnidad;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ClaveUnidad");
                throw;
            }
        }

        public async Task<object> GetClaveUnidadById(int id)
        {
            try
            {
                var claveUnidad = await _context.ClaveUnidads.FindAsync(id);
                if (claveUnidad == null)
                {
                    return new { Message = "No encontrado" };
                }
                return claveUnidad;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveUnidad by id");
                throw;
            }
        }

        public async Task<ClaveUnidad?> Update(int id, ClaveUnidad claveUnidad)
        {
            var existingClaveUnidad = await _context.ClaveUnidads.FindAsync(id);
            if (existingClaveUnidad == null)
            {
                _logger.LogWarning("Attempted to update non-existent ClaveUnidad with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingClaveUnidad.ClaveUnidadValue = claveUnidad.ClaveUnidadValue;
                existingClaveUnidad.Nombre = claveUnidad.Nombre;
                existingClaveUnidad.Descripcion = claveUnidad.Descripcion;
                existingClaveUnidad.Nota = claveUnidad.Nota;
                existingClaveUnidad.Iniciovigencia = claveUnidad.Iniciovigencia;
                existingClaveUnidad.Finvigencia = claveUnidad.Finvigencia;
                existingClaveUnidad.Simbolo = claveUnidad.Simbolo;
                existingClaveUnidad.Active = claveUnidad.Active;

                await _context.SaveChangesAsync();
                return existingClaveUnidad;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ClaveUnidad with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ClaveUnidad with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var claveUnidad = await _context.ClaveUnidads.FindAsync(id);
                if (claveUnidad == null)
                {
                    return false;
                }
                _context.ClaveUnidads.Remove(claveUnidad);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ClaveUnidad with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IClaveUnidadService
    {
        Task<List<object>> GetClaveUnidad();
        Task<List<object>> Get2fields();
        Task<object> GetClaveUnidadById(int id);
        Task<object> CreateClaveUnidad(ClaveUnidad claveUnidad);
        Task<ClaveUnidad?> Update(int id, ClaveUnidad claveUnidad);
        Task<bool> Delete(int id);
    }
}