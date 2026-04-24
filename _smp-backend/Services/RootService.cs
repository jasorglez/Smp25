using System;
using SMP.Models;
using Microsoft.EntityFrameworkCore;
using SMP.Models.context;

namespace SMP.Services
{
    public class RootService : IRootService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<RootService> _logger;

        public RootService(DbSmpContext context, ILogger<RootService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetRoot()
        {
            try
            {
                return await _context.Roots
                    .Where(r => r.Active == 1)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Companys and project ,  idCompany");
                throw;
            }
        }

      
        public async Task<List<object>> Get2fields()
        {
            try
            {
                return await _context.Roots
                    .Where(r => r.Active == 1)
                    .Select(ro => new
                    {
                      ro.Name, ro.Id
                    })
                    .AsNoTracking()
                    .OrderBy(ro => ro.Name)
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Companys and project ,  idCompany");
                throw;
            }
        }

        public async Task<object> CreateRoot(Root root)
        {
            try
            {
                var maxOrden = await _context.Roots.MaxAsync(r => (int?)r.Orden) ?? 0;
                root.Orden = maxOrden + 1;
                _context.Roots.Add(root);
                await _context.SaveChangesAsync();
                return root;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating Root");
                throw;
            }
        }

        public async Task<object> GetRootById(int id)
        {
            try
            {
                var root = await _context.Roots.FindAsync(id);
                if (root == null)
                {
                    return new { Message = "No encontrado" };
                }
                return root;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Root by id");
                throw;
            }
        }

        public async Task<Root?> Update(int id, Root root)
        {
            var existingRoot = await _context.Roots.FindAsync(id);
            if (existingRoot == null)
            {
                _logger.LogWarning("Attempted to update non-existent Root with ID {Id}", id);
                return null;
            }

            try
            {
                // Update only the properties that are allowed to be modified
                existingRoot.Name       = root.Name;
                existingRoot.Email      = root.Email;
                existingRoot.Web        = root.Web;
                existingRoot.City       = root.City;
                existingRoot.Cp         = root.Cp;
                existingRoot.State      = root.State;
                existingRoot.Country    = root.Country;
                existingRoot.FormatRep  = root.FormatRep;
                existingRoot.NameSmall  = root.NameSmall;
                existingRoot.Phone      = root.Phone;
                existingRoot.Picture    = root.Picture;
                existingRoot.Picture2   = root.Picture2;
                existingRoot.Picture3   = root.Picture3;
                existingRoot.RFC        = root.RFC;
                existingRoot.Address    = root.Address;
                existingRoot.PersonType = root.PersonType;
                existingRoot.Advanced   = root.Advanced;
                existingRoot.Orden      = root.Orden;
                existingRoot.Active     = root.Active;
                existingRoot.IdCorporativo = root.IdCorporativo;
                if (root.LicenseStart.HasValue)   existingRoot.LicenseStart = root.LicenseStart;
                if (root.LicenseDays > 0)         existingRoot.LicenseDays  = root.LicenseDays;
                if (!string.IsNullOrEmpty(root.LicenseType)) existingRoot.LicenseType = root.LicenseType;

                await _context.SaveChangesAsync();
                return existingRoot;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Root with ID {Id}", id);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Root with ID {Id}", id);
                throw;
            }
        }

    }

    public interface IRootService
    {
        Task<List<object>> GetRoot();
        Task<List<object>> Get2fields();
        Task<object> GetRootById(int id);
        Task<object> CreateRoot(Root root);
        Task<Root?> Update(int id, Root root);
    }

}