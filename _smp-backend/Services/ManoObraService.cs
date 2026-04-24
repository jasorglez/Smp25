using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class ManoObraService : IManoObraService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<ManoObraService> _logger;

        public ManoObraService(DbSmpContext context, ILogger<ManoObraService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<ManoObra>> GetByCompany(int companyId)
        {
            try
            {
                return await _context.ManoObras
                    .Where(m => m.Active && m.IdCompany == companyId)
                    .AsNoTracking()
                    .OrderBy(m => m.Description)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ManoObra for company {CompanyId}", companyId);
                throw;
            }
        }

        public async Task Save(ManoObra manoObra)
        {
            try
            {
                _context.ManoObras.Add(manoObra);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving ManoObra");
                throw;
            }
        }

        public async Task<bool> Update(int id, ManoObra manoObra)
        {
            var existing = await _context.ManoObras.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.IdCompany   = manoObra.IdCompany;
                existing.Description = manoObra.Description;
                existing.Unit        = manoObra.Unit;
                existing.UnitPrice   = manoObra.UnitPrice;
                existing.Costo       = manoObra.Costo ?? 0;
                existing.Quantity    = manoObra.Quantity;
                existing.Active      = manoObra.Active;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ManoObra {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.ManoObras.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ManoObra {Id}", id);
                throw;
            }
        }
    }

    public interface IManoObraService
    {
        Task<IEnumerable<ManoObra>> GetByCompany(int companyId);
        Task Save(ManoObra manoObra);
        Task<bool> Update(int id, ManoObra manoObra);
        Task<bool> Delete(int id);
    }
}
