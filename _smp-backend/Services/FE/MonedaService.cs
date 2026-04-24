using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class MonedaService : IMonedaService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<MonedaService> _logger;

        public MonedaService(DbSmpContext context, ILogger<MonedaService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetMoneda()
        {
            try
            {
                return await _context.Monedas
                    .Where(m => m.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Moneda");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.Monedas
                    .Where(m => m.Active)
                    .Select(m => new
                    {
                        m.Id,
                        m.CMoneda,
                        m.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(m => m.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Moneda fields");
                throw;
            }
        }

        public async Task<object> CreateMoneda(Moneda moneda)
        {
            try
            {
                _context.Monedas.Add(moneda);
                await _context.SaveChangesAsync();
                return moneda;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Moneda");
                throw;
            }
        }

        public async Task<object> GetMonedaById(int id)
        {
            try
            {
                var moneda = await _context.Monedas.FindAsync(id);
                if (moneda == null)
                {
                    return new { Message = "No encontrado" };
                }
                return moneda;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Moneda by id");
                throw;
            }
        }

        public async Task<Moneda?> Update(int id, Moneda moneda)
        {
            var existingMoneda = await _context.Monedas.FindAsync(id);
            if (existingMoneda == null)
            {
                _logger.LogWarning("Attempted to update non-existent Moneda with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingMoneda.CMoneda = moneda.CMoneda;
                existingMoneda.Descripcion = moneda.Descripcion;
                existingMoneda.Decimales = moneda.Decimales;
                existingMoneda.Porcentaje = moneda.Porcentaje;
                existingMoneda.Iniciovigencia = moneda.Iniciovigencia;
                existingMoneda.Finvigencia = moneda.Finvigencia;
                existingMoneda.Active = moneda.Active;

                await _context.SaveChangesAsync();
                return existingMoneda;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Moneda with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Moneda with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var moneda = await _context.Monedas.FindAsync(id);
                if (moneda == null)
                {
                    return false;
                }
                _context.Monedas.Remove(moneda);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Moneda with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IMonedaService
    {
        Task<List<object>> GetMoneda();
        Task<List<object>> Get2fields();
        Task<object> GetMonedaById(int id);
        Task<object> CreateMoneda(Moneda moneda);
        Task<Moneda?> Update(int id, Moneda moneda);
        Task<bool> Delete(int id);
    }
}