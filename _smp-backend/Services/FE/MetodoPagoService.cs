using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class MetodoPagoService : IMetodoPagoService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<MetodoPagoService> _logger;

        public MetodoPagoService(DbSmpContext context, ILogger<MetodoPagoService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetMetodoPago()
        {
            try
            {
                return await _context.MetodoPagos
                    .Where(m => m.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving MetodoPago");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.MetodoPagos
                    .Where(m => m.Active)
                    .Select(m => new
                    {
                        m.Id,
                        m.MetodoPagoValue,
                        m.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(m => m.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving MetodoPago fields");
                throw;
            }
        }

        public async Task<object> CreateMetodoPago(MetodoPago metodoPago)
        {
            try
            {
                _context.MetodoPagos.Add(metodoPago);
                await _context.SaveChangesAsync();
                return metodoPago;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating MetodoPago");
                throw;
            }
        }

        public async Task<object> GetMetodoPagoById(int id)
        {
            try
            {
                var metodoPago = await _context.MetodoPagos.FindAsync(id);
                if (metodoPago == null)
                {
                    return new { Message = "No encontrado" };
                }
                return metodoPago;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving MetodoPago by id");
                throw;
            }
        }

        public async Task<MetodoPago?> Update(int id, MetodoPago metodoPago)
        {
            var existingMetodoPago = await _context.MetodoPagos.FindAsync(id);
            if (existingMetodoPago == null)
            {
                _logger.LogWarning("Attempted to update non-existent MetodoPago with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingMetodoPago.MetodoPagoValue = metodoPago.MetodoPagoValue;
                existingMetodoPago.Descripcion = metodoPago.Descripcion;
                existingMetodoPago.Iniciovigencia = metodoPago.Iniciovigencia;
                existingMetodoPago.Finvigencia = metodoPago.Finvigencia;
                existingMetodoPago.Active = metodoPago.Active;

                await _context.SaveChangesAsync();
                return existingMetodoPago;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating MetodoPago with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating MetodoPago with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var metodoPago = await _context.MetodoPagos.FindAsync(id);
                if (metodoPago == null)
                {
                    return false;
                }
                _context.MetodoPagos.Remove(metodoPago);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting MetodoPago with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IMetodoPagoService
    {
        Task<List<object>> GetMetodoPago();
        Task<List<object>> Get2fields();
        Task<object> GetMetodoPagoById(int id);
        Task<object> CreateMetodoPago(MetodoPago metodoPago);
        Task<MetodoPago?> Update(int id, MetodoPago metodoPago);
        Task<bool> Delete(int id);
    }
}