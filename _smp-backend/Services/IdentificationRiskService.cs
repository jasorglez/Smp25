using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;
using System;


namespace SMP.Services
{
    public class IdentificationRiskService : IIdentificationRiskService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<IdentificationRiskService> _logger;

        public IdentificationRiskService(DbSmpContext dbContext, ILogger<IdentificationRiskService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetIdentificationRisks(int idProject, DateTime date)
        {
            try
            {
                return await _context.Identificationrisks
                    .Where(r => r.IdProject == idProject && r.Date==date && r.Active)
                    .Select(r => new
                    {
                        r.Id,
                        r.IdProject,
                        r.Classification,
                        r.Date,
                        r.Description,
                        r.Cause,
                        r.TypeRisk,
                        r.OwnerRisk
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving IdentificationRisks for project {IdProject}", idProject);
                throw;
            }
        }

        public async Task Save(Identificationrisk identificationrisk)
        {
            try
            {
                _context.Identificationrisks.Add(identificationrisk);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving IdentificationRisk");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving IdentificationRisk");
                throw;
            }
        }

        public async Task<Identificationrisk?> Update(int id, Identificationrisk identificationRisk)
        {
            var existingRisk = await _context.Identificationrisks.FindAsync(id);
            if (existingRisk == null)
            {
                _logger.LogWarning("Attempted to update non-existent IdentificationRisk with ID {Id}", id);
                return null;
            }

            try
            {
                existingRisk.IdProject = identificationRisk.IdProject;
                existingRisk.Classification = identificationRisk.Classification;
                existingRisk.Date = identificationRisk.Date;
                existingRisk.Description = identificationRisk.Description;
                existingRisk.Cause = identificationRisk.Cause;
                existingRisk.TypeRisk = identificationRisk.TypeRisk;
                existingRisk.OwnerRisk = identificationRisk.OwnerRisk;

                await _context.SaveChangesAsync();
                return existingRisk;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating IdentificationRisk with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating IdentificationRisk with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingRisk = await _context.Identificationrisks.FindAsync(id);
            if (existingRisk == null)
            {
                _logger.LogWarning("Attempted to delete non-existent IdentificationRisk with ID {Id}", id);
                return false;
            }

            try
            {
                existingRisk.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting IdentificationRisk with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting IdentificationRisk with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IIdentificationRiskService
    {
        Task<List<object>> GetIdentificationRisks(int idProject, DateTime date);
        Task Save(Identificationrisk identificationrisk);
        Task<Identificationrisk?> Update(int id, Identificationrisk identificationRisk);
        Task<bool> Delete(int id);
    }
}