using Microsoft.EntityFrameworkCore;
using SMP.Models.context;
using SMP.Models.TD;

namespace SMP.Services.TD
{
    public class ConceptsService : IConceptsService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ConceptsService> _logger;

        public ConceptsService(DbSmpContext dbContext, ILogger<ConceptsService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Concepts>> GetAllConcepts(int idCompany)
        {
            try
            {
                _logger.LogInformation("Retrieving all active concepts");
                var concepts = await _context.Concepts
                    .Where(c => c.IdCompany == idCompany && c.Active)
                    .OrderBy(c => c.Description)
                    .AsNoTracking()
                    .ToListAsync();

                _logger.LogInformation($"Found {concepts.Count} active concepts");
                return concepts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving concepts");
                throw;
            }
        }

        public async Task<Concepts?> GetConceptById(int id)
        {
            try
            {
                _logger.LogInformation($"Retrieving concept with ID {id}");
                var concept = await _context.Concepts
                    .Where(c => c.Id == id && c.Active)
                    .AsNoTracking()
                    .FirstOrDefaultAsync();

                if (concept == null)
                {
                    _logger.LogWarning($"Concept with ID {id} not found");
                }

                return concept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving concept with ID {id}");
                throw;
            }
        }

        public async Task<Concepts> CreateConcept(Concepts concept)
        {
            try
            {
                _logger.LogInformation("Creating new concept");
                concept.Active = true;
                _context.Concepts.Add(concept);
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Concept created successfully with ID {concept.Id}");
                return concept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating concept");
                throw;
            }
        }

        public async Task<Concepts?> UpdateConcept(int id, Concepts concept)
        {
            try
            {
                _logger.LogInformation($"Updating concept with ID {id}");
                var existingConcept = await _context.Concepts
                    .Where(c => c.Id == id && c.Active)
                    .FirstOrDefaultAsync();

                if (existingConcept == null)
                {
                    _logger.LogWarning($"Concept with ID {id} not found for update");
                    return null;
                }

                existingConcept.Description = concept.Description;
                existingConcept.InternalTeamValue = concept.InternalTeamValue;
                existingConcept.ExternalTeamValue = concept.ExternalTeamValue;

                await _context.SaveChangesAsync();

                _logger.LogInformation($"Concept with ID {id} updated successfully");
                return existingConcept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating concept with ID {id}");
                throw;
            }
        }

        public async Task<bool> DeleteConcept(int id)
        {
            try
            {
                _logger.LogInformation($"Deleting concept with ID {id}");
                var concept = await _context.Concepts
                    .Where(c => c.Id == id && c.Active)
                    .FirstOrDefaultAsync();

                if (concept == null)
                {
                    _logger.LogWarning($"Concept with ID {id} not found for deletion");
                    return false;
                }

                concept.Active = false;
                await _context.SaveChangesAsync();

                _logger.LogInformation($"Concept with ID {id} deleted successfully");
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error deleting concept with ID {id}");
                throw;
            }
        }
    }

    public interface IConceptsService
    {
        Task<IEnumerable<Concepts>> GetAllConcepts(int idCompany);
        Task<Concepts?> GetConceptById(int id);
        Task<Concepts> CreateConcept(Concepts concept);
        Task<Concepts?> UpdateConcept(int id, Concepts concept);
        Task<bool> DeleteConcept(int id);
    }
}