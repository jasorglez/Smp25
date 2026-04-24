using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services;

public class ContractDetailsService: IContractDetailsService
{
    private readonly DbSmpContext _context;
    private readonly ILogger<ContractDetailsService> _logger;

    public ContractDetailsService(DbSmpContext context, ILogger<ContractDetailsService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<List<Object>> GetElementsFromContractDetails(int idContract)
    {
        try
        {
            var contractDetails = await _context.ContractDetails
                .Where(cd => cd.IdContract == idContract && cd.Active)
                .AsNoTracking()
                .ToListAsync();

            if (contractDetails == null || !contractDetails.Any())
            {
                _logger.LogWarning("No contract details found for contract ID {IdContract}", idContract);
                return new List<Object>();
            }

            return contractDetails.Cast<Object>().ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving contract details for contract ID {IdContract}", idContract);
            throw;
        }
    }

    public async Task Save(ContractDetails contractDetails)
    {
        try
        {
            _context.ContractDetails.Add(contractDetails);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Contract Details");
            throw;
        }
    }
    
    public async Task<ContractDetails?> Update(int id, ContractDetails contractDetails)
    {
        var existingContractDetails = await _context.ContractDetails.FindAsync(id);
        if (existingContractDetails == null)
        {
            _logger.LogWarning("Contract Details with ID {Id} not found", id);
            return null;
        }
        try
        {
            existingContractDetails.IdContract = contractDetails.IdContract;
            existingContractDetails.DocumentName = contractDetails.DocumentName;
            existingContractDetails.UrlDocument = contractDetails.UrlDocument;
            existingContractDetails.Active = contractDetails.Active;
            
            await _context.SaveChangesAsync();
            return existingContractDetails;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Contract Details");
            throw;
        }
    }
    
    public async Task<bool> Delete(int id)
    {
        var contractDetails = await _context.ContractDetails.FindAsync(id);
        if (contractDetails == null)
        {
            _logger.LogWarning("Contract Details with ID {Id} not found", id);
            return false;
        }
        
        try
        {
            contractDetails.Active = false; // Soft delete
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting Contract Details with ID {Id}", id);
            throw;
        }
    }
}

public interface IContractDetailsService
{
    Task<List<Object>> GetElementsFromContractDetails(int idContract);
    Task Save(ContractDetails contractDetails);
    Task<ContractDetails?> Update(int id, ContractDetails contractDetails);
    Task<bool> Delete(int id);
}