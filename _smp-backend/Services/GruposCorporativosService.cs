using System;
using SMP.Models;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services
{
    public class GruposCorporativosService : IGruposCorporativosService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<GruposCorporativosService> _logger;

        public GruposCorporativosService(DbSmpContext context, ILogger<GruposCorporativosService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetAll()
        {
            try
            {
                return await _context.GruposCorporativos
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving GruposCorporativos");
                throw;
            }
        }

        public async Task<object> GetById(int id)
        {
            try
            {
                var entity = await _context.GruposCorporativos.FindAsync(id);
                if (entity == null)
                {
                    return new { Message = "No encontrado" };
                }
                return entity;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving GruposCorporativo by id");
                throw;
            }
        }

        public async Task<object> Save(GruposCorporativo entity)
        {
            try
            {
                _context.GruposCorporativos.Add(entity);
                await _context.SaveChangesAsync();
                return entity;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating GruposCorporativo");
                throw;
            }
        }

        public async Task<GruposCorporativo?> Update(int id, GruposCorporativo entity)
        {
            var existing = await _context.GruposCorporativos.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent GruposCorporativo with ID {Id}", id);
                return null;
            }

            try
            {
                existing.Name     = entity.Name;
                existing.Partner1 = entity.Partner1;
                existing.Partner2 = entity.Partner2;
                existing.Partner3 = entity.Partner3;
                existing.Partner4   = entity.Partner4;
                existing.Partner5   = entity.Partner5;
                existing.Image    = entity.Image;
                existing.Comment  = entity.Comment;
                existing.Active   = entity.Active;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating GruposCorporativo with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IGruposCorporativosService
    {
        Task<List<object>> GetAll();
        Task<object> GetById(int id);
        Task<object> Save(GruposCorporativo entity);
        Task<GruposCorporativo?> Update(int id, GruposCorporativo entity);
    }
}
