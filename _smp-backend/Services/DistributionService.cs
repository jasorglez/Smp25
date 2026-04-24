using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class DistributionService : IDistributionService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<DistributionService> _logger;

        public DistributionService(DbSmpContext context, ILogger<DistributionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<IEnumerable<Distribution>> GetByReference(int idReference, string type, int idCompany)
        {
            return await _context.Distributions
                .Where(d => d.IdReference == idReference && d.Type == type && d.IdCompany == idCompany && d.Active == true)
                .OrderBy(d => d.Year).ThenBy(d => d.Month)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task Save(Distribution distribution)
        {
            _context.Distributions.Add(distribution);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> Update(int id, Distribution distribution)
        {
            var existing = await _context.Distributions.FindAsync(id);
            if (existing == null) return false;

            existing.Year = distribution.Year;
            existing.Month = distribution.Month;
            existing.Quantity = distribution.Quantity;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Distributions.FindAsync(id);
            if (existing == null) return false;

            existing.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
    }

    public interface IDistributionService
    {
        Task<IEnumerable<Distribution>> GetByReference(int idReference, string type, int idCompany);
        Task Save(Distribution distribution);
        Task<bool> Update(int id, Distribution distribution);
        Task<bool> Delete(int id);
    }
}
