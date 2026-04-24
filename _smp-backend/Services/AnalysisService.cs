using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class AnalysisServices : IAnalysisService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<AnalysisServices> _logger;

        public AnalysisServices(DbSmpContext dbContext, ILogger<AnalysisServices> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<Analysi>> Get(int idIdentification)
        {
            try
            {
                return await _context.Analysis
                    .Where(a => a.IdIdentification == idIdentification && a.Active==1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Analyses");
                throw;
            }
        }

        public async Task<List<object>> totalxseverity()
        {

            var result = await(
                from a in _context.Analysis
                where a.Active == 1
                group a by a.Severity into g
                select new 
                {
                    Severity      = g.Key,
                    totalseverity = g.Count(),
                    SeverityLevel = (g.Key == 1 ? "Bajo" :
                            g.Key == 2 ? "Medio" :
                            g.Key == 3 ? "Alto" : "Desconocido")
                })
                .OrderBy(x => x.Severity)
                .AsNoTracking()
                .ToListAsync<object>();

            return result;
        }

        public async Task<Analysi> Save(Analysi analysis)
        {
            try
            {
                _logger.LogInformation($"Attempting to save Analysis. Id before save: {analysis.Id}");
                analysis.Id = 0;
                _logger.LogInformation($"Id set to 0. Attempting to add to context.");
                _context.Analysis.Add(analysis);
                _logger.LogInformation("Calling SaveChangesAsync.");
                await _context.SaveChangesAsync();
                _logger.LogInformation($"Save successful. New Id: {analysis.Id}");
                return analysis;
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Analysis");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Analysis");
                throw;
            }
        }

        public async Task<Analysi?> Update(int id, Analysi analysis)
        {
            var existing = await _context.Analysis.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Analysis with ID {Id}", id);
                return null;
            }
            try
            {
                // Update only the properties that are allowed to be modified
                existing.IdIdentification = analysis.IdIdentification;
                existing.Idwp = analysis.Idwp;
                existing.DateStart = analysis.DateStart;
                existing.DateEnd = analysis.DateEnd;
                existing.RouteCritica = analysis.RouteCritica;
                existing.Severity = analysis.Severity;
                existing.Phase = analysis.Phase;

                await _context.SaveChangesAsync();
                return existing;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Analysis with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Analysis with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Analysis.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Analysis with ID {Id}", id);
                return false;
            }
            try
            {
                _context.Analysis.Remove(existing);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Analysis with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Analysis with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IAnalysisService
    {
        Task<List<Analysi>> Get(int idIdentification);
        Task<List<object>> totalxseverity();
        Task<Analysi> Save(Analysi analysis);
        Task<Analysi?> Update(int id, Analysi analysis);
        Task<bool> Delete(int id);
    }
}