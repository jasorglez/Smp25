using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class AdvancedService : IAdvancedService
    {
        private DbSmpContext _context;
        private readonly ILogger<AdvancedService> _logger;

        public AdvancedService(DbSmpContext dbContext, ILogger<AdvancedService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // Obtiene los avances dependiendo del tipo: "Contrato" o "Proyecto".
        public async Task<IEnumerable<Advanced>> Get(int id, string tipo)
        {
            try
            {
                IQueryable<Advanced> query = _context.Advanceds.AsNoTracking();

                if (tipo.Equals("Contract", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdContract == id && a.Active == 1);
                }
                else if (tipo.Equals("Project", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdProject == id && a.Active == 1);
                }
                else
                {
                    throw new ArgumentException("Type should be 'Contract' or 'Project'.");
                }

                return await query.ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Data");
                throw;
            }
        }

        public async Task Save(Advanced ad)
        {
            try
            {
                _context.Advanceds.Add(ad);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Advanced");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Advanceds");
                throw;
            }
        }

        // Actualiza un avance existente basado en su ID.
        public async Task<bool> Update(int id, Advanced updatedAdvanced)
        {
            try
            {
                var existingAdvanced = await _context.Advanceds.FindAsync(id);
                if (existingAdvanced == null)
                {
                    _logger.LogWarning($"El avance con Id {id} no existe.");
                    return false;
                }

                // Actualizar los campos
                existingAdvanced.IdConvenio         = updatedAdvanced.IdConvenio;
                existingAdvanced.Date               = updatedAdvanced.Date;
                existingAdvanced.PhysicalAdvanced   = updatedAdvanced.PhysicalAdvanced;
                existingAdvanced.ProgramAdvanced    = updatedAdvanced.ProgramAdvanced;
                existingAdvanced.AccumulateProgram  = updatedAdvanced.AccumulateProgram;
                existingAdvanced.AccumulatePhysical = updatedAdvanced.AccumulatePhysical;
                
                _context.Advanceds.Update(existingAdvanced);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error actualizando el avance con Id {id}.");
                throw;
            }
        }

        // Elimina un avance basado en su ID.
        public async Task<bool> Delete(int id)
        {
                var existing = await _context.Advanceds.FindAsync(id);
                if (existing == null)
                {
                    _logger.LogWarning("Attempted to update non-existent Advanced With ID");
                    return false;
                }
                try
                {
                    existing.Active = 0;
                    await _context.SaveChangesAsync();
                    return true;
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    _logger.LogError(ex, "Concurrency error occurred while updating Advanceds with ID ", id);
                    return false;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while Delete Logic Advanced with ID ", id);
                    throw;
                }
            }
    }

    // Interfaz con los métodos Get, Update y Delete
    public interface IAdvancedService
    {
        Task<IEnumerable<Advanced>> Get(int id, string tipo);
        Task Save(Advanced ad);
        Task<bool> Update(int id, Advanced updatedAdvanced);
        Task<bool> Delete(int id);
    }
}
