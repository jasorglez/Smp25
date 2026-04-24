using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class GeneratorService : IGeneratorService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<GeneratorService> _logger;

        public GeneratorService(DbSmpContext context, ILogger<GeneratorService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetGenerators(int idEstimacion)
        {
            try
            {
                return await _context.Generators
                    .Where(g => g.IdEstimacion == idEstimacion && g.Active)
                    .Select(g => new
                    {
                        g.Id,
                        g.IdEstimacion,
                        g.Numero,
                        g.DateStart,
                        g.DateEnd,
                        g.Creado, g.Revisado, g.Autorizado,
                        g.Comment, g.Fase,
                        g.AplicaIsometrico,
                        g.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Generators for estimacion {IdEstimacion}", idEstimacion);
                throw;
            }
        }

        public async Task<List<object>> GetAllGenerators()
        {
            try
            {
                return await _context.Generators
                    .Where(g => g.Active)
                    .Select(g => new
                    {
                        g.Id,
                        g.IdEstimacion,
                        g.Numero,
                        g.DateStart,
                        g.DateEnd,
                        g.AplicaIsometrico,
                        g.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all Generators");
                throw;
            }
        }

        public async Task<Generator?> GetGeneratorById(int id)
        {
            try
            {
                return await _context.Generators
                    .AsNoTracking()
                    .FirstOrDefaultAsync(g => g.Id == id && g.Active);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Generator with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(Generator generator)
        {
            try
            {
                _context.Generators.Add(generator);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Generator");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Generator");
                throw;
            }
        }

        public async Task<Generator?> Update(int id, Generator generator)
        {
            var existingItem = await _context.Generators.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to update non-existent Generator with ID {Id}", id);
                return null;
            }

            try
            {
                existingItem.IdEstimacion = generator.IdEstimacion;
                existingItem.Numero = generator.Numero;
                existingItem.DateStart = generator.DateStart;
                existingItem.DateEnd = generator.DateEnd;
                existingItem.AplicaIsometrico = generator.AplicaIsometrico;      
                existingItem.Fase = generator.Fase; 
                existingItem.Creado = generator.Creado; 
                existingItem.Revisado = generator.Revisado; 
                existingItem.Autorizado = generator.Autorizado;
                await _context.SaveChangesAsync();
                return existingItem;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Generator with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Generator with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingItem = await _context.Generators.FindAsync(id);
            if (existingItem == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Generator with ID {Id}", id);
                return false;
            }

            try
            {
                existingItem.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Generator with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Generator with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> ExistsAsync(int id)
        {
            try
            {
                return await _context.Generators.AnyAsync(g => g.Id == id && g.Active);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking if Generator exists with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IGeneratorService
    {
        Task<List<object>> GetGenerators(int idEstimacion);
        Task<List<object>> GetAllGenerators();
        Task<Generator?> GetGeneratorById(int id);
        Task Save(Generator generator);
        Task<Generator?> Update(int id, Generator generator);
        Task<bool> Delete(int id);
        Task<bool> ExistsAsync(int id);
    }
}