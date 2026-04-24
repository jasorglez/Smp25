using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class ClaveProdServService : IClaveProdServService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ClaveProdServService> _logger;

        public ClaveProdServService(DbSmpContext context, ILogger<ClaveProdServService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetClaveProdServ()
        {
            try
            {
                return await _context.ClaveProdServs
                    .Where(c => c.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveProdServ");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.ClaveProdServs
                    .Where(c => c.Active)
                    .Select(c => new
                    {
                        c.Id,c.ClaveProdServValue,
                        c.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(c => c.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveProdServ fields");
                throw;
            }
        }

        public async Task<object> CreateClaveProdServ(ClaveProdServ claveProdServ)
        {
            try
            {
                _context.ClaveProdServs.Add(claveProdServ);
                await _context.SaveChangesAsync();
                return claveProdServ;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ClaveProdServ");
                throw;
            }
        }

        public async Task<object> GetClaveProdServById(int id)
        {
            try
            {
                var claveProdServ = await _context.ClaveProdServs.FindAsync(id);
                if (claveProdServ == null)
                {
                    return new { Message = "No encontrado" };
                }
                return claveProdServ;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ClaveProdServ by id");
                throw;
            }
        }

        public async Task<ClaveProdServ?> Update(int id, ClaveProdServ claveProdServ)
        {
            var existingClaveProdServ = await _context.ClaveProdServs.FindAsync(id);
            if (existingClaveProdServ == null)
            {
                _logger.LogWarning("Attempted to update non-existent ClaveProdServ with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingClaveProdServ.ClaveProdServValue = claveProdServ.ClaveProdServValue;
                existingClaveProdServ.Descripcion = claveProdServ.Descripcion;
                existingClaveProdServ.IncluirIVATraslado = claveProdServ.IncluirIVATraslado;
                existingClaveProdServ.IncluirIEPSTraslado = claveProdServ.IncluirIEPSTraslado;
                existingClaveProdServ.Complemento = claveProdServ.Complemento;
                existingClaveProdServ.Iniciovigencia = claveProdServ.Iniciovigencia;
                existingClaveProdServ.Finvigencia = claveProdServ.Finvigencia;
                existingClaveProdServ.EstimuloFranja = claveProdServ.EstimuloFranja;
                existingClaveProdServ.PalabrasSimilares = claveProdServ.PalabrasSimilares;
                existingClaveProdServ.Active = claveProdServ.Active;

                await _context.SaveChangesAsync();
                return existingClaveProdServ;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ClaveProdServ with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ClaveProdServ with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var claveProdServ = await _context.ClaveProdServs.FindAsync(id);
                if (claveProdServ == null)
                {
                    return false;
                }
                _context.ClaveProdServs.Remove(claveProdServ);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ClaveProdServ with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IClaveProdServService
    {
        Task<List<object>> GetClaveProdServ();
        Task<List<object>> Get2fields();
        Task<object> GetClaveProdServById(int id);
        Task<object> CreateClaveProdServ(ClaveProdServ claveProdServ);
        Task<ClaveProdServ?> Update(int id, ClaveProdServ claveProdServ);
        Task<bool> Delete(int id);
    }
}