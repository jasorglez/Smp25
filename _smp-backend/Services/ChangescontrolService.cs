
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class ChangescontrolService : IChangesControlService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ChangescontrolService> _logger;

        public ChangescontrolService(DbSmpContext dbContext, ILogger<ChangescontrolService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> ChangesControlxProject(int idProject, DateTime date)
        {
            try
            {
                return await _context.Changes
                    .Where(c => c.IdProject == idProject && c.Date == date && c.Active == true)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdProject,
                        c.Date,
                        c.Concept,
                        c.Scope,
                        c.Time,
                        c.Cost,
                        c.Coordinate,
                        c.Resident,
                        c.Supervisor,
                        c.StartDate,
                        c.EndDate,
                        c.Amount,
                        c.Observation,
                        c.AuthorizeUser,
                        c.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ChangesControl for project {IdProject}", idProject);
                throw;
            }
        }

        public async Task<List<object>> ChangesControlxDate(DateTime date)
        {
            try
            {
                return await _context.Changes
                    .Where(c => c.Date == date && c.Active == true)
                    .Select(c => new
                    {
                        c.Id,
                        c.IdProject,
                        c.Date,
                        c.Concept,
                        c.Scope,
                        c.Time,
                        c.Cost,
                        c.Coordinate,
                        c.Resident,
                        c.Supervisor,
                        c.StartDate,
                        c.EndDate,
                        c.Amount,
                        c.Observation,
                        c.AuthorizeUser
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ChangesControl for date {Date}", date);
                throw;
            }
        }

        public async Task Save(Changescontrol changesControl)
        {
            try
            {
                _context.Changes.Add(changesControl);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving ChangesControl");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ChangesControl");
                throw;
            }
        }

        public async Task<Changescontrol?> Update(int id, Changescontrol changesControl)
        {
            var existChangesControl = await _context.Changes.FindAsync(id);
            if (existChangesControl == null)
            {
                _logger.LogWarning("Attempted to update non-existent ChangesControl with ID {Id}", id);
                return null;
            }

            try
            {
                existChangesControl.IdProject = changesControl.IdProject;
                existChangesControl.Date = changesControl.Date;
                existChangesControl.Concept = changesControl.Concept;
                existChangesControl.Scope = changesControl.Scope;
                existChangesControl.Time = changesControl.Time;
                existChangesControl.Cost = changesControl.Cost;
                existChangesControl.Coordinate = changesControl.Coordinate;
                existChangesControl.Resident = changesControl.Resident;
                existChangesControl.Supervisor = changesControl.Supervisor;
                existChangesControl.StartDate = changesControl.StartDate;
                existChangesControl.EndDate = changesControl.EndDate;
                existChangesControl.Amount = changesControl.Amount;
                existChangesControl.Observation = changesControl.Observation;
                existChangesControl.AuthorizeUser = changesControl.AuthorizeUser;

                await _context.SaveChangesAsync();
                return existChangesControl;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating ChangesControl with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating ChangesControl with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingChangesControl = await _context.Changes.FindAsync(id);
            if (existingChangesControl == null)
            {
                _logger.LogWarning("Attempted to delete non-existent ChangesControl with ID {Id}", id);
                return false;
            }

            try
            {
                existingChangesControl.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting ChangesControl with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting ChangesControl with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IChangesControlService
    {
        Task<List<object>> ChangesControlxProject(int idProject, DateTime date);
        Task<List<object>> ChangesControlxDate(DateTime date);
        Task Save(Changescontrol changesControl);
        Task<Changescontrol?> Update(int id, Changescontrol changesControl);
        Task<bool> Delete(int id);
    }
}
