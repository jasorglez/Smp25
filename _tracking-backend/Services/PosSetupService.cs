using MicroServicioTracking.Controllers;

namespace MicroServicioTracking.Services;

using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

public class PosSetupService : IPosSetupService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<PosSetupController> _logger;

    public PosSetupService(DbTrackingContext context, ILogger<PosSetupController> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<Object>> GetByBranch(int branchId)
    {
        try
        {
            return await _context.PosSetups
                .Where(p => p.IdBranch == branchId)
                .Select(p => new
                {
                    p.Id,
                    p.IdBranch,
                    p.IdCustomer,
                    p.IdDocumentType,
                    p.Prefix,
                    p.Consecutive,
                    p.SalesExistence,
                    p.PrintScreen,
                    p.Active
                })
                .AsNoTracking()
                .ToListAsync<Object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            throw;
        }
    }

        public async Task<List<PosSetup>> GetByBranchAndCustomer(int branchId, int customerId)
        {
            return await _context.PosSetups
                .Where(p => p.IdBranch == branchId && p.IdCustomer == customerId)
                .ToListAsync();
        }
    
    public async Task Save(PosSetup posSetup)
    {
        try
        {
            _context.PosSetups.Add(posSetup);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            throw;
        }
    }

    public async Task<PosSetup?> Update(int branchId, int customerId, PosSetup posSetup)
    {
        try
        {
            var existingPosSetup = await _context.PosSetups
                .FirstOrDefaultAsync(p => p.IdBranch == branchId && p.IdCustomer == customerId);
            if (existingPosSetup == null)
            {
                return null;
            }
            existingPosSetup.IdBranch = posSetup.IdBranch;
            existingPosSetup.IdCustomer = posSetup.IdCustomer;
            existingPosSetup.IdDocumentType = posSetup.IdDocumentType;
            existingPosSetup.Prefix = posSetup.Prefix;
            existingPosSetup.Consecutive = posSetup.Consecutive;
            existingPosSetup.SalesExistence = posSetup.SalesExistence;
            existingPosSetup.PrintScreen = posSetup.PrintScreen;
            existingPosSetup.Active = posSetup.Active;
            await _context.SaveChangesAsync();
            return existingPosSetup;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, ex.Message);
            throw;
        }
    }
}

public interface IPosSetupService
{
    Task<List<object>> GetByBranch(int branchId);
    Task<List<PosSetup>> GetByBranchAndCustomer(int branchId, int customerId);

    Task Save(PosSetup posSetup);
    Task<PosSetup?> Update(int branchId, int customerId, PosSetup posSetup);
}