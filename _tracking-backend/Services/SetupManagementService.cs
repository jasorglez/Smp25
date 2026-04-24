using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class SetupManagementService: ISetupManagementService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<SetupManagementService> _logger;

    public SetupManagementService(DbTrackingContext context, ILogger<SetupManagementService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<SetupManagement>> ConfigByRoot(int idRoot)
    {
        try
        {

            return await _context.SetupManagement
                .Where(sm => sm.IdRoot == idRoot && sm.Active == true)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Setup for Root ID {IdRoot}", idRoot);
            throw;
        }
    }

    public async Task Save(SetupManagement setupManagement)
    {
        try
        {
            _context.SetupManagement.Add(setupManagement);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            throw;
        }
    }

    public async Task<SetupManagement?> Update(int idRoot, SetupManagement setupManagement)
    {
        var existingSetupManagement = await _context.SetupManagement
            .FirstOrDefaultAsync(sm => sm.IdRoot == idRoot);
        if (existingSetupManagement == null)
        {
            _logger.LogWarning("Attempted to update non-existent Setup with ID Root {IdRoot}", idRoot);
            return null;
        }

        try
        {
            existingSetupManagement.DirectorName = setupManagement.DirectorName;
            existingSetupManagement.DirectorTitle = setupManagement.DirectorTitle;
            existingSetupManagement.GerencyName = setupManagement.GerencyName;
            existingSetupManagement.GerencyTitle = setupManagement.GerencyTitle;
            existingSetupManagement.AdministratorName = setupManagement.AdministratorName;
            existingSetupManagement.AdministratorTitle = setupManagement.AdministratorTitle;
            existingSetupManagement.OperatorName = setupManagement.OperatorName;
            existingSetupManagement.OperatorTitle = setupManagement.OperatorTitle;
            existingSetupManagement.ConsecutiveReceipt = setupManagement.ConsecutiveReceipt;
            existingSetupManagement.ConsecutiveCreditNote = setupManagement.ConsecutiveCreditNote;
            existingSetupManagement.Iva = setupManagement.Iva;
            existingSetupManagement.Active = setupManagement.Active;

            await _context.SaveChangesAsync();
            return existingSetupManagement;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Setup with ID {IdRoot}", idRoot);
            throw;
        }
    }
}

public interface ISetupManagementService
{
    Task<List<SetupManagement>> ConfigByRoot(int idRoot);
    Task Save(SetupManagement setupManagement);
    Task<SetupManagement?> Update(int idRoot, SetupManagement setupManagement);
}