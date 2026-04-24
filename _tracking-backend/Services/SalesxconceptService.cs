using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class SalesxconceptService : ISalesxconceptService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<SalesxconceptService> _logger;

        public SalesxconceptService(DbTrackingContext context, ILogger<SalesxconceptService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetBySaleId(int saleId)
        {
            try
            {
                return await _context.Salesxconcepts
                    .Where(s => s.IdSale == saleId && s.Active == true)
                    .Select(s => new
                    {
                        s.Id,
                        s.IdProduct,
                        s.IdSale,
                        s.Quantity,
                        s.Pu,
                        s.Total,
                        s.Unit,
                        s.BoxNumber,
                        s.UnitNumber,
                        s.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Sales concepts for Sale ID {Id}", saleId);
                throw;
            }
        }

        public async Task<Salesxconcept?> GetById(int id)
        {
            try
            {
                return await _context.Salesxconcepts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Id == id && s.Active == true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Sales concept with ID {Id}", id);
                throw;
            }
        }

        public async Task Save(Salesxconcept concept)
        {
            try
            {
                _context.Salesxconcepts.Add(concept);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Sales concept");
                throw;
            }
        }

        public async Task<Salesxconcept?> Update(int id, Salesxconcept concept)
        {
            var existingConcept = await _context.Salesxconcepts.FindAsync(id);
            if (existingConcept == null)
            {
                _logger.LogWarning("Attempted to update non-existent Sales concept with ID {Id}", id);
                return null;
            }

            try
            {
                existingConcept.IdProduct = concept.IdProduct;
                existingConcept.IdSale = concept.IdSale;
                existingConcept.Quantity = concept.Quantity;
                existingConcept.Pu = concept.Pu;
                existingConcept.Unit = concept.Unit;
                existingConcept.BoxNumber = concept.BoxNumber;
                existingConcept.UnitNumber = concept.UnitNumber;
                existingConcept.Active = concept.Active;

                await _context.SaveChangesAsync();
                return existingConcept;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating Sales concept with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existingConcept = await _context.Salesxconcepts.FindAsync(id);
            if (existingConcept == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Sales concept with ID {Id}", id);
                return false;
            }

            try
            {
                existingConcept.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting Sales concept with ID {Id}", id);
                throw;
            }
        }
    }

    public interface ISalesxconceptService
    {
        Task<List<object>> GetBySaleId(int saleId);
        Task<Salesxconcept?> GetById(int id);
        Task Save(Salesxconcept concept);
        Task<Salesxconcept?> Update(int id, Salesxconcept concept);
        Task<bool> Delete(int id);
    }
}