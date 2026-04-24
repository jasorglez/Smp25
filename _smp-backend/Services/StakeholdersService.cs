using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models;

namespace SMP.Services
{
    public class StakeholderService : IStakeholderService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<StakeholderService> _logger;

        public StakeholderService(DbSmpContext dbContext, ILogger<StakeholderService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> StakeholdersxProject(int idProject, DateTime date)
        {
            try
            {
                return await _context.Stakeholders
                    .Where(s => s.IdProject == idProject &&  s.Date==date && s.Active == true)
                    .Select(s => new
                    {
                        s.Id,
                        s.Date,s.IdProvider,
                        s.IdProject,
                        s.Image1,
                        s.Image2,
                        s.Image3,
                        s.Image4,
                        s.Image5, 
                        s.NavProvider.Type,s.AuthorizeUser,
                        s.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Stakeholders for project {IdProject}", idProject);
                throw;
            }
        }

        public async Task<List<object>> Type(string type)
        {
            try
            {
                return await _context.Stakeholders
                    .Where(s =>  s.Active == true)
                    .Select(s => new
                    {
                        s.Id,
                        s.Date,s.IdProvider,
                        s.IdProject,
                        s.Image1,
                        s.Image2,
                        s.Image3,
                        s.Image4,
                        s.Image5,s.AuthorizeUser,s.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Stakeholders for project {type}");
                throw;
            }
        }

        public async Task<List<object>> StakeholdersxDate(DateTime date)
        {
            try
            {
                return await _context.Stakeholders
                    .Where(s => s.Date == date && s.Active == true)
                    .Select(s => new
                    {
                        s.Id,
                        s.Date,
                        s.IdProvider,
                        s.IdProject,
                        s.Image1,
                        s.Image2,
                        s.Image3,
                        s.Image4,
                        s.Image5
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Stakeholders for date {Date}", date);
                throw;
            }
        }

        public async Task Save(Stakeholder stakeholder)
        {
            try
            {
                _context.Stakeholders.Add(stakeholder);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Stakeholder");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Stakeholder");
                throw;
            }
        }

        public async Task<Stakeholder?> Update(int id, Stakeholder stakeholder)
        {
            var existStakeholder = await _context.Stakeholders.FindAsync(id);
            if (existStakeholder == null)
            {
                _logger.LogWarning("Attempted to update non-existent Stakeholder with ID {Id}", id);
                return null;
            }

            try
            {
                existStakeholder.Date = stakeholder.Date;
                existStakeholder.IdProject = stakeholder.IdProject;
                existStakeholder.IdProvider = stakeholder.IdProvider;
                existStakeholder.Image1 = stakeholder.Image1;
                existStakeholder.Image2 = stakeholder.Image2;
                existStakeholder.Image3 = stakeholder.Image3;
                existStakeholder.Image4 = stakeholder.Image4;
                existStakeholder.Image5 = stakeholder.Image5;

                await _context.SaveChangesAsync();
                return existStakeholder;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Stakeholder with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Stakeholder with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingStakeholder = await _context.Stakeholders.FindAsync(id);
            if (existingStakeholder == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Stakeholder with ID {Id}", id);
                return false;
            }

            try
            {
                existingStakeholder.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while deleting Stakeholder with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Stakeholder with ID {Id}", id);
                throw;
            }
        }
    }

    public interface IStakeholderService
    {
        Task<List<object>> StakeholdersxProject(int idProject, DateTime date);
        Task<List<object>> StakeholdersxDate(DateTime date);
        Task Save(Stakeholder stakeholder);
        Task<Stakeholder?> Update(int id, Stakeholder stakeholder);
        Task<bool> Delete(int id);
    }
}