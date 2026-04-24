using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    public class BranchService : IBranchService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<BranchService> _logger;

        public BranchService(DbSmpContext dbContext, ILogger<BranchService> logger)
        {
            _context = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<object>> GetAllBranches()
        {
            try
            {
                return await _context.Branchs
                    .Where(b => b.Active == true)
                    .Join(
                        _context.Roots,          // Tabla con la que haremos el JOIN
                        branch => branch.IdCompany,  // Campo de Branch para el JOIN
                        root => root.Id,         // Campo de Root para el JOIN
                        (branch, root) => new    // Proyección del resultado
                        {
                            branch.Id,
                            branch.IdCompany,
                            RootName = root.Name,  // Campo del JOIN que queremos incluir
                            branch.IdEstado,
                            branch.Name,
                            branch.Description,
                            branch.Address,
                            branch.Orden,
                            branch.Vigente,
                            branch.Active
                        })
                    .OrderBy(b => b.RootName)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving branches");
                throw;
            }
        }

        public async Task<List<object>> GetBranches(int idCompany)
        {
            try
            {
                return await _context.Branchs
                    .Where(b => (b.IdCompany == idCompany && b.Active == true))
                    .Select(b => new
                    {
                        b.Id,
                        b.IdCompany,
                        b.IdEstado,
                        b.Name,
                        b.Description,
                        b.Address, b.Orden,
                        b.Vigente, b.Active
                    })
                    .OrderBy(b => b.Vigente)
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving branches for company {IdCompany}", idCompany);
                throw;
            }
        }

        public async Task<List<object>> twoBranches(int idCompany)
        {
            try
            {
                return await _context.Branchs
                    .Where(b => (b.IdCompany == idCompany && b.Active == true))
                    .OrderBy(b => b.Orden)
                    .Select(b => new
                    {
                        b.Id,
                        b.Name,
                        b.Active
                    })
                    .AsNoTracking()
                    .ToListAsync<object>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving branches for company {IdCompany}", idCompany);
                throw;
            }
        }
        
        public async Task Save(Branch branch)
        {
            try
            {
                _context.Branchs.Add(branch);
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database update error while saving branch");
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving branch");
                throw;
            }
        }

        public async Task<bool> Update(int id, Branch branch)
        {
            var existingBranch = await _context.Branchs.FindAsync(id);
            if (existingBranch == null)
            {
                return false;
            }

            try
            {
                _context.Entry(existingBranch).CurrentValues.SetValues(branch);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error while updating branch with ID {Id}", id);
                return false;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating branch with ID {Id}", id);
                throw;
            }
        }

        public async Task<DeleteBranchResult> Delete(int id)
        {

            Console.WriteLine("----------------- BRANCH SERVICE Delete called with ID: " + id);

            try {

                var canDeleteInfo = await _context.CanDeleteBranchesxReason
                    .Where(v => v.BranchId == id)
                    .Select(v => new { v.CanDelete, Reasons = v.Reasons ?? string.Empty })
                    .FirstOrDefaultAsync();

                if (canDeleteInfo == null)
                {
                    return new DeleteBranchResult
                    {
                        Success = false,
                        Message = $"No se encontró información sobre la sucursal",
                        CanDelete = null,
                        Reasons = null
                    };
                }
               
                if (canDeleteInfo.CanDelete == 0)
                {
                    return new DeleteBranchResult
                    {
                        Success = false,
                        Message = $"No es posible eliminar la sucursal debido a que involucra las siguiente entidades: {canDeleteInfo.Reasons}",
                        CanDelete = canDeleteInfo.CanDelete,
                        Reasons = canDeleteInfo.Reasons
                    };
                }

                var existingBranch = await _context.Branchs.FindAsync(id);

                _logger.LogInformation("----------------- BRANCH SERVICE Delete existingBranch: " + System.Text.Json.JsonSerializer.Serialize(existingBranch));

                if (existingBranch == null)
                    return new DeleteBranchResult
                    {
                        Success = false,
                        Message = $"No se encontró la sucursal con ID: {id}",
                        CanDelete = canDeleteInfo.CanDelete,
                        Reasons = canDeleteInfo.Reasons
                    };
                
                existingBranch.Active = false; // Set Active to false instead of deleting
                //_context.Entry(existingBranch).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                
                return new DeleteBranchResult
                {
                    Success = true,
                    Message = $"Se ha eliminado correctamente la sucursal",
                    CanDelete = canDeleteInfo.CanDelete,
                    Reasons = canDeleteInfo.Reasons
                };
                
            }
            catch (DbUpdateConcurrencyException ex)
            {
                _logger.LogError(ex, "Concurrency error while updating branch with ID {Id}", id);
                return new DeleteBranchResult
                {
                    Success = false,
                    Message = "Error de concurrencia al actualizar la sucursal",
                    CanDelete = null,
                    Reasons = ex.Message
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting branch with ID {Id}", id);
                throw;
            } 
        }
    }

    public interface IBranchService
    {
        Task<List<object>> GetBranches(int idCompany);
        Task<List<object>> GetAllBranches();
        Task<List<object>> twoBranches(int idCompany);
        Task Save(Branch branch);
        Task<bool> Update(int id, Branch branch);
        Task<DeleteBranchResult> Delete(int id);
    }
}