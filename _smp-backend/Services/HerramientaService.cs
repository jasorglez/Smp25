using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class HerramientaService : IHerramientaService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<HerramientaService> _logger;

        public HerramientaService(DbSmpContext context, ILogger<HerramientaService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Herramienta>> GetByCompany(int companyId)
        {
            try
            {
                return await _context.Herramientas
                    .Where(h => h.Active && h.IdCompany == companyId)
                    .AsNoTracking()
                    .OrderBy(h => h.Description)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Herramientas for company {CompanyId}", companyId);
                throw;
            }
        }

        public async Task Save(Herramienta herramienta)
        {
            try
            {
                _context.Herramientas.Add(herramienta);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Herramienta");
                throw;
            }
        }

        public async Task<bool> Update(int id, Herramienta herramienta)
        {
            var existing = await _context.Herramientas.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.IdCompany   = herramienta.IdCompany;
                existing.Description = herramienta.Description;
                existing.Unit        = herramienta.Unit;
                existing.CostMN      = herramienta.CostMN;
                existing.Active      = herramienta.Active;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Herramienta {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Herramientas.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Herramienta {Id}", id);
                throw;
            }
        }
    }

    public interface IHerramientaService
    {
        Task<IEnumerable<Herramienta>> GetByCompany(int companyId);
        Task Save(Herramienta herramienta);
        Task<bool> Update(int id, Herramienta herramienta);
        Task<bool> Delete(int id);
    }
}
