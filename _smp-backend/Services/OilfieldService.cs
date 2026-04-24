

using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class OilfieldService : IOilfieldService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<OilfieldService> _logger;

        public OilfieldService(DbSmpContext dbContext, ILogger<OilfieldService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));

        }

        public async Task<List<Oilfield>> Oilfield()
        {
            try
            {
                return await _context.Oilfields
                    .Where(c => c.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
                         
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfield");
                throw;
            }
        }

        public async Task<List<object>> GetContractProjectsAsync()
        {
            try
            {
                return await _context.Projects
                    .Include(p => p.NavOilfield)
                    .Include(p => p.NavContract)
                    .Where(p => p.Active == 1)
                    .Select(p => new
                    {
                        Contract      = p.NavContract.NumberContract ?? "Sin contrato",
                        speciality    = p.NavContract.Speciality ?? "Sin especialidad",
                        state         = p.NavContract.StateContract ?? "Sin estado", 
                        NameContrato  = p.NavContract.DescripSmall ?? "Sin Nombre",
                        ProjectName   = p.Name,
                        OilfieldState = p.NavOilfield.NameState ?? "Sin Nombre",
                        AmountMX = p.NavContract != null ? p.NavContract.AmountMx : 0m, // Default to 0 if NavContract is null
                        AmountDLL = p.NavContract != null ? p.NavContract.AmountDll : 0m // Default to 0 if NavContract is null
                    })
                    .OrderBy(p => p.Contract)
                    .AsNoTracking()
                    .Cast<object>()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Contract Projects information");
                throw;
            }
        }

        public async Task Save(Oilfield oi)
        {
            try
            {
                _context.Oilfields.Add(oi);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Oilfield");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Oilfield");
                throw;
            }
        }
               
        public async Task<bool> Update(int id, Oilfield oi)
        {
            var existingOi = await _context.Oilfields.FindAsync(id);
            if (existingOi == null)
            {
                _logger.LogWarning("Attempted to update non-existent Oilfield with ID {Id}", id);
                return false;
            }

            try
            {
                // Update only the properties that are allowed to be modified                
                existingOi.Name        = oi.Name;
                existingOi.Direccion   = oi.Direccion;
                existingOi.Place = oi.Place;
                existingOi.NameState = oi.NameState;
                existingOi.Coordinates = oi.Coordinates;               

                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Oilfield with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Oilfield with ID {Id}", id);
                throw;
            }
        }

        public async Task<List<Oilfield>> GetOilfieldsByContractId(int contractId)
        {
            try
            {
                return await _context.Oilfields
                    .Where(o => o.ContractId == contractId && o.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by ContractId {ContractId}", contractId);
                throw;
            }
        }

        public async Task<List<Oilfield>> GetOilfieldsByProjectId(int projectId)
        {
            try
            {
                return await _context.Oilfields
                    .Where(o => o.ProjectId == projectId && o.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by ProjectId {ProjectId}", projectId);
                throw;
            }
        }

        public async Task<List<Oilfield>> GetOilfieldsById(int oilId)
        {
            try
            {
                return await _context.Oilfields
                    .Where(o => o.Id == oilId && o.Active == 1)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Oilfields by Oilfield {oilId}", oilId);
                throw;
            }
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Oilfields.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to update non-existent Oilfield With ID");
                return false;
            }
            try
            {
                existing.Active = 0;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Oilfield with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while Delete Logic Oilfield with ID {Id}", id);
                throw;
            }
        }

    }

    public interface IOilfieldService
    {
        Task<List<Oilfield>> Oilfield();
        Task<List<object>> GetContractProjectsAsync();
        Task<List<Oilfield>> GetOilfieldsByContractId(int contractId);
        Task<List<Oilfield>> GetOilfieldsByProjectId(int projectId);
        Task<List<Oilfield>> GetOilfieldsById(int oilId);
        Task Save(Oilfield oi);
        Task<bool> Update(int id, Oilfield oi);
        Task<bool> Delete(int id);
    }

 }