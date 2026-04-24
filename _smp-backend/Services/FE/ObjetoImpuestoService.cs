using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class ObjetoImpuestoService : IObjetoImpuestoService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ObjetoImpuestoService> _logger;

        public ObjetoImpuestoService(DbSmpContext context, ILogger<ObjetoImpuestoService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetObjetoImpuesto()
        {
            try
            {
                return await _context.ObjetoImpuestos
                    .Where(o => o.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoImpuesto");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.ObjetoImpuestos
                    .Where(o => o.Active)
                    .Select(o => new
                    {
                        o.Objeto,
                        o.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(o => o.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoImpuesto fields");
                throw;
            }
        }

        public async Task<object> CreateObjetoImpuesto(ObjetoImpuesto objetoImpuesto)
        {
            try
            {
                _context.ObjetoImpuestos.Add(objetoImpuesto);
                await _context.SaveChangesAsync();
                return objetoImpuesto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ObjetoImpuesto");
                throw;
            }
        }

        public async Task<object> GetObjetoImpuestoById(int id)
        {
            try
            {
                var objetoImpuesto = await _context.ObjetoImpuestos.FindAsync(id);
                if (objetoImpuesto == null)
                {
                    return new { Message = "No encontrado" };
                }
                return objetoImpuesto;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoImpuesto by id");
                throw;
            }
        }

        public async Task<ObjetoImpuesto?> Update(int id, ObjetoImpuesto objetoImpuesto)
        {
            var existingObjetoImpuesto = await _context.ObjetoImpuestos.FindAsync(id);
            if (existingObjetoImpuesto == null)
            {
                _logger.LogWarning("Attempted to update non-existent ObjetoImpuesto with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingObjetoImpuesto.Objeto = objetoImpuesto.Objeto;
                existingObjetoImpuesto.Descripcion = objetoImpuesto.Descripcion;
                existingObjetoImpuesto.InicioVigencia = objetoImpuesto.InicioVigencia;
                existingObjetoImpuesto.FinVigencia = objetoImpuesto.FinVigencia;
                existingObjetoImpuesto.Active = objetoImpuesto.Active;

                await _context.SaveChangesAsync();
                return existingObjetoImpuesto;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ObjetoImpuesto with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ObjetoImpuesto with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var objetoImpuesto = await _context.ObjetoImpuestos.FindAsync(id);
                if (objetoImpuesto == null)
                {
                    return false;
                }
                _context.ObjetoImpuestos.Remove(objetoImpuesto);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ObjetoImpuesto with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IObjetoImpuestoService
    {
        Task<List<object>> GetObjetoImpuesto();
        Task<List<object>> Get2fields();
        Task<object> GetObjetoImpuestoById(int id);
        Task<object> CreateObjetoImpuesto(ObjetoImpuesto objetoImpuesto);
        Task<ObjetoImpuesto?> Update(int id, ObjetoImpuesto objetoImpuesto);
        Task<bool> Delete(int id);
    }
}