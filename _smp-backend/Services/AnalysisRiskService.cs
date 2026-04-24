using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class AnalysisRiskService : IAnalysisRiskService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<AnalysisRiskService> _logger;

        public AnalysisRiskService(DbSmpContext dbContext, ILogger<AnalysisRiskService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetAnalysisRisks(int idIdentification)
        {
            try
            {
                return await _context.Analysisrisks
                    .Where(ar => ar.IdIdentification == idIdentification && ar.Active == true)
                    .Select(ar => new
                    {
                        ar.Id,
                        ar.IdIdentification,
                        ar.IdProgram,
                        ar.StartDate,
                        ar.EndDate,
                        ar.RouteCritic,
                        ar.Probability,
                        ar.Scope,
                        ar.Time,
                        ar.Cost,
                        ar.Quality,
                        ar.Average,
                        ar.Calification,
                        ar.Urgency,
                        ar.IdFase,
                        ar.Answer
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving AnalysisRisks for project {IdProject}", idIdentification);
                throw;
            }
        }

        public async Task Save(Analysisrisk analysisrisk)
        {
            try
            {
                _context.Analysisrisks.Add(analysisrisk);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving AnalysisRisk");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving AnalysisRisk");
                throw;
            }
        }

        public async Task<Analysisrisk?> Update(int id, Analysisrisk analysisrisk)
        {
            var existingAnalysisRisk = await _context.Analysisrisks.FindAsync(id);
            if (existingAnalysisRisk == null)
            {
                _logger.LogWarning("Attempted to update non-existent AnalysisRisk with ID {Id}", id);
                return null;
            }

            try
            {
                existingAnalysisRisk.IdIdentification = analysisrisk.IdIdentification;
                existingAnalysisRisk.IdProgram = analysisrisk.IdProgram;
                existingAnalysisRisk.StartDate = analysisrisk.StartDate;
                existingAnalysisRisk.EndDate = analysisrisk.EndDate;
                existingAnalysisRisk.RouteCritic = analysisrisk.RouteCritic;
                existingAnalysisRisk.Probability = analysisrisk.Probability;
                existingAnalysisRisk.Scope = analysisrisk.Scope;
                existingAnalysisRisk.Time = analysisrisk.Time;
                existingAnalysisRisk.Cost = analysisrisk.Cost;
                existingAnalysisRisk.Quality = analysisrisk.Quality;
                existingAnalysisRisk.Urgency = analysisrisk.Urgency;
                existingAnalysisRisk.IdFase = analysisrisk.IdFase;
                existingAnalysisRisk.Answer = analysisrisk.Answer;

                await _context.SaveChangesAsync();
                return existingAnalysisRisk;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating AnalysisRisk with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating AnalysisRisk with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingAnalysisRisk = await _context.Analysisrisks.FindAsync(id);
            if (existingAnalysisRisk == null)
            {
                _logger.LogWarning("Attempted to delete non-existent AnalysisRisk with ID {Id}", id);
                return false;
            }

            try
            {
                existingAnalysisRisk.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting AnalysisRisk with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting AnalysisRisk with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IAnalysisRiskService
    {
        Task<List<object>> GetAnalysisRisks(int idIdentification);
        Task Save(Analysisrisk analysisrisk);
        Task<Analysisrisk?> Update(int id, Analysisrisk analysisRisk);
        Task<bool> Delete(int id);
    }
}