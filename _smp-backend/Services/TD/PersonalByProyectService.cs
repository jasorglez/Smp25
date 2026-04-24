using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models.TD;

namespace SMP.Services.TD
{
    public class PersonalByProyectService : IPersonalByProyectService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<PersonalByProyectService> _logger;

        public PersonalByProyectService(DbSmpContext dbContext, ILogger<PersonalByProyectService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        
        public async Task<List<PersonalByProyect>> GetPersonalByProyectById(int idProyect)
        {
            try
            {
                var personalByProyect = await _context.PersonalByProyect
                    .Where(c => c.IdProyect == idProyect && c.Active)
                    .ToListAsync();

                if (personalByProyect == null || personalByProyect.Count == 0)
                {
                    _logger.LogWarning($"No personalByProyect found for project ID {idProyect}");
                }

                return personalByProyect;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving personalByProyect with ID {idProyect}");
                throw;
            }
        }
       public async Task<List<ProyectoCountDto>> GetPersonalByProyect()
        {
            try
            {
                var result = await _context.PersonalByProyect
                    .Where(c => c.Active) // si solo quieres activos
                    .GroupBy(c => c.IdProyect)
                    .Select(g => new ProyectoCountDto
                    {
                        IdProyect = g.Key,
                        Count = g.Count()
                    })
                    .ToListAsync();

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving counts by project");
                throw;
            }
        }
        

        public async Task<PersonalByProyect> CreatepersonalByProyect(PersonalByProyect personalByProyect)
        {
            try
            {
                _logger.LogInformation("Creating new personalByProyect");
                personalByProyect.Active = true;
                _context.PersonalByProyect.Add(personalByProyect);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"personalByProyect created successfully with ID {personalByProyect.Id}");
                return personalByProyect;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating personalByProyect");
                throw;
            }
        }

        public async Task<PersonalByProyect?> UpdatepersonalByProyect(int id, PersonalByProyect personalByProyect)
        {
            try
            {
                _logger.LogInformation($"Updating personalByProyect with ID {id}");
                var existingpersonalByProyect = await _context.PersonalByProyect
                    .Where(c => c.Id == id && c.Active)
                    .FirstOrDefaultAsync();

                if (existingpersonalByProyect == null)
                {
                    _logger.LogWarning($"personalByProyect with ID {id} not found for update");
                    return null;
                }

                existingpersonalByProyect.IdPersonal = personalByProyect.IdPersonal;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"personalByProyect with ID {id} updated successfully");
                return existingpersonalByProyect;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating personalByProyect with ID {id}");
                throw;
            }
        }

        public async Task<bool> DeletepersonalByProyect(int id)
        {
            try
            {
                _logger.LogInformation($"Deleting personalByProyect with ID {id}");
                var personalByProyect = await _context.PersonalByProyect
                    .Where(c => c.Id == id && c.Active)
                    .FirstOrDefaultAsync();

                if (personalByProyect == null)
                {
                    _logger.LogWarning($"personalByProyect with ID {id} not found for deletion");
                    return false;
                }

                personalByProyect.Active = false;
                await _context.SaveChangesAsync();

                _logger.LogInformation($"personalByProyect with ID {id} deleted successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting personalByProyect with ID {id}");
                throw;
            }
        }

    }

    public class ProyectoCountDto
    {
        public int IdProyect { get; set; }
        public int Count { get; set; }
    }

    public interface IPersonalByProyectService
    {
        Task<List<PersonalByProyect>> GetPersonalByProyectById(int idProyect);
        Task<List<ProyectoCountDto>> GetPersonalByProyect();
        Task<PersonalByProyect> CreatepersonalByProyect(PersonalByProyect personalByProyect);
        Task<PersonalByProyect?> UpdatepersonalByProyect(int id, PersonalByProyect personalByProyect);
        Task<bool> DeletepersonalByProyect(int id);
    }
}