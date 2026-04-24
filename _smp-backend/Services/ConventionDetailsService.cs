using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services;

public class ConventionDetailsService: IConventionDetailsService
{
    private readonly DbSmpContext _context;
    private readonly ILogger<ConventionDetailsService> _logger;

    public ConventionDetailsService(DbSmpContext context, ILogger<ConventionDetailsService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }
    
    public async Task<List<Object>> GetElementsFromConventionDetails(int idConvention)
    {
        try
        {
            var conventionDetails = await _context.ConventionDetails
                .Where(cd => cd.IdConvention == idConvention && cd.Active)
                .AsNoTracking()
                .ToListAsync();

            if (conventionDetails == null || !conventionDetails.Any())
            {
                _logger.LogWarning("No convention details found for convention ID {IdConvention}", idConvention);
                return new List<Object>();
            }

            return conventionDetails.Cast<Object>().ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving convention details for convention ID {IdConvention}", idConvention);
            throw;
        }
    }
    
    public async Task Save(ConventionDetails conventionDetails)
    {
        try
        {
            _context.ConventionDetails.Add(conventionDetails);
            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving Convention Details");
            throw;
        }
    }
    
    public async Task<ConventionDetails?> Update(int id, ConventionDetails conventionDetails)
    {
        var existingConventionDetails = await _context.ConventionDetails.FindAsync(id);
        if (existingConventionDetails == null)
        {
            _logger.LogWarning("Convention Details with ID {Id} not found", id);
            return null;
        }

        existingConventionDetails.IdConvention = conventionDetails.IdConvention;
        existingConventionDetails.DocumentName = conventionDetails.DocumentName;
        existingConventionDetails.UrlDocument = conventionDetails.UrlDocument;
        existingConventionDetails.Active = conventionDetails.Active;

        try
        {
            await _context.SaveChangesAsync();
            return existingConventionDetails;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating Convention Details with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var conventionDetails = await _context.ConventionDetails.FindAsync(id);
        if (conventionDetails == null)
        {
            _logger.LogWarning("Convention Details with ID {Id} not found", id);
            return false;
        }

        try
        {
            conventionDetails.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine(ex);
            throw;
        }
    }
}

public interface IConventionDetailsService
{
    Task<List<Object>> GetElementsFromConventionDetails(int idConvention);
    Task Save(ConventionDetails conventionDetails);
    Task<ConventionDetails?> Update(int id, ConventionDetails conventionDetails);
    Task<bool> Delete(int id);
}