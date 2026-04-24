using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class HRManagementService : IHRManagementService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<HRManagementService> _logger;

    public HRManagementService(DbTrackingContext context, ILogger<HRManagementService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<HRManagement>> ConfigByRoot(int idBranch)
    {
        try
        {

            return await _context.HRManagement
                .Where(hr => hr.IdBranch == idBranch && hr.Active == true)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Setup for Branch ID {IdBranch}", idBranch);
            throw;
        }
    }
    
    public async Task Save(HRManagement hrManagement)
    {
        try
        {
            _context.HRManagement.Add(hrManagement);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            throw;
        }
    }

    public async Task<HRManagement?> Update(int idBranch, HRManagement hrManagement)
    {
        var existingHRManagement = await _context.HRManagement
            .FirstOrDefaultAsync(hr => hr.IdBranch == idBranch);
        if (existingHRManagement == null)
        {
            _logger.LogWarning("Attempted to update non-existent Setup with ID Branch {IdBranch}", idBranch);
            return null;
        }

        try
        {
            existingHRManagement.IdBranch = hrManagement.IdBranch;
            existingHRManagement.Active = hrManagement.Active;
            existingHRManagement.StartDay = hrManagement.StartDay;
            existingHRManagement.ClockTolerance = hrManagement.ClockTolerance;
            existingHRManagement.Vigency = hrManagement.Vigency;
            existingHRManagement.Discount = hrManagement.Discount;
            existingHRManagement.Discount1 = hrManagement.Discount1;
            existingHRManagement.Discount2 = hrManagement.Discount2;
            existingHRManagement.Delay1 = hrManagement.Delay1;
            existingHRManagement.Delay2 = hrManagement.Delay2;
            existingHRManagement.PayrollPeriod = hrManagement.PayrollPeriod;
            existingHRManagement.SettingToleranceTime = hrManagement.SettingToleranceTime;
            existingHRManagement.OvertimePay = hrManagement.OvertimePay;
            existingHRManagement.SpecialOvertimePay = hrManagement.SpecialOvertimePay;
            existingHRManagement.IdentificationBlockPeriod = hrManagement.IdentificationBlockPeriod;

            await _context.SaveChangesAsync();
            return existingHRManagement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Setup with ID {IdBranch}", idBranch);
            throw;
        }
    }
}

public interface IHRManagementService
{
    Task<List<HRManagement>> ConfigByRoot(int idRoot);
    Task Save(HRManagement hrManagement);
    Task<HRManagement?> Update(int idRoot, HRManagement hrManagement);
}