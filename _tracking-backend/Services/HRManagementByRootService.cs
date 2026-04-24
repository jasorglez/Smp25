using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class HRManagementByRootService : IHRManagementByRootService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<HRManagementByRootService> _logger;

    public HRManagementByRootService(DbTrackingContext context, ILogger<HRManagementByRootService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<HRManagementByRoot>> ConfigByRoot(int idRoot)
    {
        try
        {

            return await _context.HRManagementByRoot
                .Where(hr => hr.IdRoot == idRoot && hr.Active == true)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Setup for root ID {IdRoot}", idRoot);
            throw;
        }
    }
    
    public async Task Save(HRManagementByRoot hrManagementByRoot)
    {
        try
        {
            _context.HRManagementByRoot.Add(hrManagementByRoot);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            throw;
        }
    }

    public async Task<HRManagementByRoot?> Update(int idRoot, HRManagementByRoot hrManagementByRoot)
    {
        var existingHRManagementByRoot = await _context.HRManagementByRoot
            .FirstOrDefaultAsync(hr => hr.IdRoot == idRoot);
        if (existingHRManagementByRoot == null)
        {
            _logger.LogWarning("Attempted to update non-existent Setup with ID root {IdRoot}", idRoot);
            return null;
        }

        try
        {
            existingHRManagementByRoot.IdRoot = hrManagementByRoot.IdRoot;
            existingHRManagementByRoot.Prefix = hrManagementByRoot.Prefix;
            existingHRManagementByRoot.Consecutive = hrManagementByRoot.Consecutive;
            existingHRManagementByRoot.Active = hrManagementByRoot.Active;

            await _context.SaveChangesAsync();
            return existingHRManagementByRoot;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Setup with ID {IdRoot}", idRoot);
            throw;
        }
    }
}

public interface IHRManagementByRootService
{
    Task<List<HRManagementByRoot>> ConfigByRoot(int idRoot);
    Task Save(HRManagementByRoot hrManagementByRoot);
    Task<HRManagementByRoot?> Update(int idRoot, HRManagementByRoot hrManagementByRoot);
}