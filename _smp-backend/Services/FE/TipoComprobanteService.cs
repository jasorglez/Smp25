using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class TipoComprobanteService : ITipoComprobanteService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<TipoComprobanteService> _logger;

        public TipoComprobanteService(DbSmpContext context, ILogger<TipoComprobanteService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetTipoComprobante()
        {
            try
            {
                return await _context.TipoComprobantes
                    .Where(t => t.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TipoComprobante");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.TipoComprobantes
                    .Where(t => t.Active)
                    .Select(t => new
                    {
                        t.Id,
                        t.TipoDeComprobante,
                        t.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(t => t.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TipoComprobante fields");
                throw;
            }
        }

        public async Task<object> CreateTipoComprobante(TipoComprobante tipoComprobante)
        {
            try
            {
                _context.TipoComprobantes.Add(tipoComprobante);
                await _context.SaveChangesAsync();
                return tipoComprobante;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating TipoComprobante");
                throw;
            }
        }

        public async Task<object> GetTipoComprobanteById(int id)
        {
            try
            {
                var tipoComprobante = await _context.TipoComprobantes.FindAsync(id);
                if (tipoComprobante == null)
                {
                    return new { Message = "No encontrado" };
                }
                return tipoComprobante;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving TipoComprobante by id");
                throw;
            }
        }

        public async Task<TipoComprobante?> Update(int id, TipoComprobante tipoComprobante)
        {
            var existingTipoComprobante = await _context.TipoComprobantes.FindAsync(id);
            if (existingTipoComprobante == null)
            {
                _logger.LogWarning("Attempted to update non-existent TipoComprobante with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingTipoComprobante.TipoDeComprobante = tipoComprobante.TipoDeComprobante;
                existingTipoComprobante.Descripcion = tipoComprobante.Descripcion;
                existingTipoComprobante.ValorMaximo = tipoComprobante.ValorMaximo;
                existingTipoComprobante.Iniciovigencia = tipoComprobante.Iniciovigencia;
                existingTipoComprobante.Finvigencia = tipoComprobante.Finvigencia;
                existingTipoComprobante.Active = tipoComprobante.Active;

                await _context.SaveChangesAsync();
                return existingTipoComprobante;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating TipoComprobante with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating TipoComprobante with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var tipoComprobante = await _context.TipoComprobantes.FindAsync(id);
                if (tipoComprobante == null)
                {
                    return false;
                }
                _context.TipoComprobantes.Remove(tipoComprobante);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting TipoComprobante with ID {Id}", id);
                return false;
            }
        }
    }

    public interface ITipoComprobanteService
    {
        Task<List<object>> GetTipoComprobante();
        Task<List<object>> Get2fields();
        Task<object> GetTipoComprobanteById(int id);
        Task<object> CreateTipoComprobante(TipoComprobante tipoComprobante);
        Task<TipoComprobante?> Update(int id, TipoComprobante tipoComprobante);
        Task<bool> Delete(int id);
    }
}