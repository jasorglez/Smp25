using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ConventionService : IConventionService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ConventionService> _logger;

        public ConventionService(DbSmpContext dbContext, ILogger<ConventionService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Convention>> Get()
        {
            try
            {
                return await _context.Conventions
                    .Where(c => c.Active == true)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Conventions");
                throw;
            }
        }


        public async Task<List<object>> Convention2fields(int idContract)
        {
            try
            {
                IQueryable<Convention> query = _context.Conventions.Where(c => c.IdContract==idContract && c.Active == true);


                return await query
                    .Select(co => new
                    {
                        co.Description,
                        co.Id
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contracts");
                throw;
            }
        }

        public async Task<IEnumerable<Convention>> GetCP(int id, string tipo)
        {
            try
            {
                IQueryable<Convention> query = _context.Conventions.AsNoTracking();

                if (tipo.Equals("Contract", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdContract == id);
                }
                else if (tipo.Equals("Project", StringComparison.OrdinalIgnoreCase))
                {
                    query = query.Where(a => a.IdProject == id);
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

        public async Task<Convention?> GetVigente(int idContract)
        {
            try
            {
                return await _context.Conventions
                    .Where(c => c.IdContract == idContract && c.Vigente == true && c.Active == true)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vigente convention for contract {IdContract}", idContract);
                throw;
            }
        }

        public async Task<Convention?> GetVigenteByProject(int idProject)
        {
            try
            {
                return await _context.Conventions
                    .Where(c => c.IdProject == idProject && c.Vigente == true && c.Active == true)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vigente convention for project {IdProject}", idProject);
                throw;
            }
        }

        public async Task<IEnumerable<Convention>> GetxContract(int idContract)
        {
            try
            {
                return await _context.Conventions
                    .Where(c => c.Active == true && c.IdContract == idContract)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Conventions");
                throw;
            }
        }

        public async Task Save(Convention Co)
        {
            try
            {
                _context.Conventions.Add(Co);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Conventions");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Conventions");
                throw;
            }
        }

        public async Task<bool> Update(int id, Convention Co)
        {
            var existingCo = await _context.Conventions.FindAsync(id);
            if (existingCo == null)
            {
                _logger.LogWarning("Attempted to update non-existent Conventions with ID {Id}", id);
                return false;
            }

            try
            {
                // Update only the properties that are allowed to be modified                
                existingCo.Name        = Co.Name;
                existingCo.Description = Co.Description;
                existingCo.Start       = Co.Start;
                existingCo.End         = Co.End;
                existingCo.Vigente     = Co.Vigente;
                existingCo.AmountDLL   = Co.AmountDLL;
                existingCo.AmountMX    = Co.AmountMX;
                existingCo.Comment     = Co.Comment;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Conventions with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Conventions with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Conventions.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Conventions With ID");
                return false;
            }
            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Conventions with ID ", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while Delete Logic Conventions with ID ", id);
                throw;
            }
        }

    }

    public interface IConventionService
    {
        Task<IEnumerable<Convention>> Get();
        Task<List<object>> Convention2fields(int idContract);
        Task<IEnumerable<Convention>> GetCP(int id, string tipo);
        Task<Convention?> GetVigente(int idContract);
        Task<Convention?> GetVigenteByProject(int idProject);
        Task<IEnumerable<Convention>> GetxContract(int idContract);
        Task Save(Convention Co);
        Task<bool> Update(int id, Convention Co);
        Task<bool> Delete(int id);  
    }
}
