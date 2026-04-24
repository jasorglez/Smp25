using System;
using SMP.Models.FE;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services.FE
{
    public class UsoCfdiService : IUsoCfdiService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<UsoCfdiService> _logger;

        public UsoCfdiService(DbSmpContext context, ILogger<UsoCfdiService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetUsoCfdi()
        {
            try
            {
                return await _context.UsoCfdis
                    .Where(u => u.Active)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving UsoCfdi");
                throw;
            }
        }

        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.UsoCfdis
                    .Where(u => u.Active)
                    .Select(u => new
                    {
                        u.Id,
                        u.CUsoCFDI,
                        u.Descripcion
                    })
                    .AsNoTracking()
                    .OrderBy(u => u.Descripcion)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving UsoCfdi fields");
                throw;
            }
        }

        public async Task<object> CreateUsoCfdi(UsoCfdi usoCfdi)
        {
            try
            {
                _context.UsoCfdis.Add(usoCfdi);
                await _context.SaveChangesAsync();
                return usoCfdi;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating UsoCfdi");
                throw;
            }
        }

        public async Task<object> GetUsoCfdiById(int id)
        {
            try
            {
                var usoCfdi = await _context.UsoCfdis.FindAsync(id);
                if (usoCfdi == null)
                {
                    return new { Message = "No encontrado" };
                }
                return usoCfdi;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving UsoCfdi by id");
                throw;
            }
        }

        public async Task<UsoCfdi?> Update(int id, UsoCfdi usoCfdi)
        {
            var existingUsoCfdi = await _context.UsoCfdis.FindAsync(id);
            if (existingUsoCfdi == null)
            {
                _logger.LogWarning("Attempted to update non-existent UsoCfdi with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingUsoCfdi.CUsoCFDI = usoCfdi.CUsoCFDI;
                existingUsoCfdi.Descripcion = usoCfdi.Descripcion;
                existingUsoCfdi.AplicaParaFisica = usoCfdi.AplicaParaFisica;
                existingUsoCfdi.AplicaParaMoral = usoCfdi.AplicaParaMoral;
                existingUsoCfdi.Iniciovigencia = usoCfdi.Iniciovigencia;
                existingUsoCfdi.Finvigencia = usoCfdi.Finvigencia;
                existingUsoCfdi.RegimenFiscal = usoCfdi.RegimenFiscal;
                existingUsoCfdi.Active = usoCfdi.Active;

                await _context.SaveChangesAsync();
                return existingUsoCfdi;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating UsoCfdi with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating UsoCfdi with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            try
            {
                var usoCfdi = await _context.UsoCfdis.FindAsync(id);
                if (usoCfdi == null)
                {
                    return false;
                }
                _context.UsoCfdis.Remove(usoCfdi);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting UsoCfdi with ID {Id}", id);
                return false;
            }
        }
    }

    public interface IUsoCfdiService
    {
        Task<List<object>> GetUsoCfdi();
        Task<List<object>> Get2fields();
        Task<object> GetUsoCfdiById(int id);
        Task<object> CreateUsoCfdi(UsoCfdi usoCfdi);
        Task<UsoCfdi?> Update(int id, UsoCfdi usoCfdi);
        Task<bool> Delete(int id);
    }
}