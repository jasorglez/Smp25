using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class AuxiliarService : IAuxiliarService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<AuxiliarService> _logger;

        public AuxiliarService(DbSmpContext context, ILogger<AuxiliarService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Auxiliar>> GetByCompany(int companyId)
        {
            try
            {
                return await _context.Auxiliares
                    .Where(a => a.Active && a.IdCompany == companyId)
                    .AsNoTracking()
                    .OrderBy(a => a.Description)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Auxiliares for company {CompanyId}", companyId);
                throw;
            }
        }

        public async Task Save(Auxiliar auxiliar)
        {
            try
            {
                _context.Auxiliares.Add(auxiliar);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Auxiliar");
                throw;
            }
        }

        public async Task<bool> Update(int id, Auxiliar auxiliar)
        {
            var existing = await _context.Auxiliares.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.IdCompany      = auxiliar.IdCompany;
                existing.Description   = auxiliar.Description;
                existing.Unit          = auxiliar.Unit;
                existing.CostMN        = auxiliar.CostMN;
                existing.HasPersonal   = auxiliar.HasPersonal;
                existing.HasMaterial   = auxiliar.HasMaterial;
                existing.HasHerramienta= auxiliar.HasHerramienta;
                existing.HasEquipo     = auxiliar.HasEquipo;
                existing.Active        = auxiliar.Active;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Auxiliar {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Auxiliares.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Auxiliar {Id}", id);
                throw;
            }
        }
    }

    public interface IAuxiliarService
    {
        Task<IEnumerable<Auxiliar>> GetByCompany(int companyId);
        Task Save(Auxiliar auxiliar);
        Task<bool> Update(int id, Auxiliar auxiliar);
        Task<bool> Delete(int id);
    }
}
