using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class EquipmentService : IEquipmentService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<EquipmentService> _logger;

        public EquipmentService(DbSmpContext dbContext, ILogger<EquipmentService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IEnumerable<Equipment>> Get()
        {
            try
            {
                return await _context.Equipments
                    .Where(e => e.Active == true)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments");
                throw;
            }
        }

        public async Task<IEnumerable<Equipment>> GetByCompany(int companyId)
        {
            try
            {
                return await _context.Equipments
                    .Where(e => e.Active == true && e.IdCompany == companyId)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for company {CompanyId}", companyId);
                throw;
            }
        }

        public async Task<IEnumerable<Equipment>> GetByBranch(int branchId)
        {
            try
            {
                return await _context.Equipments
                    .Where(e => e.Active == true && e.IdBranch == branchId)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for branch {BranchId}", branchId);
                throw;
            }
        }

        public async Task<IEnumerable<Equipment>> GetByType(int typeId)
        {
            try
            {
                return await _context.Equipments
                    .Where(e => e.Active == true && e.IdTypeEquipment == typeId)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Equipments for type {TypeId}", typeId);
                throw;
            }
        }

        public async Task Save(Equipment equipment)
        {
            try
            {
                _context.Equipments.Add(equipment);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving Equipment");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving Equipment");
                throw;
            }
        }

        public async Task SaveFromAssets(Equipment equipment)
        {
            await EnsureCompanyAndBranchForAssets(equipment);
            await Save(equipment);
        }

        public async Task<bool> Update(int id, Equipment equipment)
        {
            var existingEquipment = await _context.Equipments.FindAsync(id);
            if (existingEquipment == null)
            {
                _logger.LogWarning("Attempted to update non-existent Equipment with ID {Id}", id);
                return false;
            }

            try
            {
                existingEquipment.IdCompany = equipment.IdCompany;
                existingEquipment.IdBranch = equipment.IdBranch;
                existingEquipment.IdTypeEquipment = equipment.IdTypeEquipment;
                existingEquipment.Description = equipment.Description;
                existingEquipment.AssetType = equipment.AssetType;
                existingEquipment.Measure = equipment.Measure;
                existingEquipment.Quantity = equipment.Quantity;
                existingEquipment.CostMN = equipment.CostMN;
                existingEquipment.CostDLL = equipment.CostDLL;
                existingEquipment.PriceMN = equipment.PriceMN;
                existingEquipment.PriceDLL = equipment.PriceDLL;
                existingEquipment.DaysWork = equipment.DaysWork;
                existingEquipment.Print = equipment.Print;
                existingEquipment.Charged = equipment.Charged;
                existingEquipment.Active = equipment.Active;

                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error occurred while updating Equipment with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while updating Equipment with ID {Id}", id);
                throw;
            }
        }

        public async Task<bool> UpdateFromAssets(int id, Equipment equipment)
        {
            await EnsureCompanyAndBranchForAssets(equipment);
            return await Update(id, equipment);
        }

        public async Task<bool> Delete(int id)
        {
            var existing = await _context.Equipments.FindAsync(id);
            if (existing == null)
            {
                _logger.LogWarning("Attempted to delete non-existent Equipment with ID {Id}", id);
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
                _logger.LogError(ex, "Concurrency error occurred while deleting Equipment with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while deleting Equipment with ID {Id}", id);
                throw;
            }
        }

        private async Task EnsureCompanyAndBranchForAssets(Equipment equipment)
        {
            if ((equipment.IdCompany ?? 0) <= 0 && (equipment.IdBranch ?? 0) <= 0)
            {
                throw new ArgumentException("Equipment for assets requires idCompany or idBranch.");
            }

            if ((equipment.IdCompany ?? 0) > 0 && (equipment.IdBranch ?? 0) > 0)
            {
                return;
            }

            if ((equipment.IdBranch ?? 0) > 0 && (equipment.IdCompany ?? 0) <= 0)
            {
                var companyId = await _context.Branchs
                    .Where(b => b.Id == equipment.IdBranch && b.Active == true)
                    .Select(b => b.IdCompany)
                    .FirstOrDefaultAsync();

                if (companyId.HasValue && companyId.Value > 0)
                {
                    equipment.IdCompany = companyId.Value;
                }
                return;
            }

            if ((equipment.IdCompany ?? 0) > 0 && (equipment.IdBranch ?? 0) <= 0)
            {
                var branchId = await _context.Branchs
                    .Where(b => b.IdCompany == equipment.IdCompany && b.Active == true)
                    .Select(b => b.Id)
                    .FirstOrDefaultAsync();

                if (branchId > 0)
                {
                    equipment.IdBranch = branchId;
                }
            }
        }
    }

    public interface IEquipmentService
    {
        Task<IEnumerable<Equipment>> Get();
        Task<IEnumerable<Equipment>> GetByCompany(int companyId);
        Task<IEnumerable<Equipment>> GetByBranch(int branchId);
        Task<IEnumerable<Equipment>> GetByType(int typeId);
        Task Save(Equipment equipment);
        Task SaveFromAssets(Equipment equipment);
        Task<bool> Update(int id, Equipment equipment);
        Task<bool> UpdateFromAssets(int id, Equipment equipment);
        Task<bool> Delete(int id);
    }
}
