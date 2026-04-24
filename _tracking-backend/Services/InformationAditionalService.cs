using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using System.Collections.Generic;

namespace MicroServicioTracking.Services
{
    public class InformationAditionalService : IInformationAditionalService
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<InformationAditionalService> _logger;

        public InformationAditionalService(DbTrackingContext context, ILogger<InformationAditionalService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<InformationAditional>> GetAll(int idInExp)
        {
            try
            {
                return await _context.InformationAditionals
                    .Where(ia => ia.IdIncorexp == idInExp && ia.Active == true)
                    .AsNoTracking()
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving all additional information");
                throw;
            }
        }

        public async Task<InformationAditional?> GetByIdAsync(int id)
        {
            try
            {
                return await _context.InformationAditionals
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ia => ia.Id == id && ia.Active == true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving additional information with ID {Id}", id);
                throw;
            }
        }

        public async Task SaveAsync(InformationAditional informationAditional)
        {
            try
            {
                _context.InformationAditionals.Add(informationAditional);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving additional information");
                throw;
            }
        }

        public async Task<InformationAditional?> UpdateAsync(int idInExp, InformationAditional informationAditional)
{
    var existingInfo = await _context.InformationAditionals
        .FirstOrDefaultAsync(ia => ia.IdIncorexp == idInExp && ia.Active == true);
    if (existingInfo == null)
    {
        _logger.LogWarning("Attempted to update non-existent additional information with IdIncorexp {IdIncorexp}", idInExp);
        return null;
    }

    try
    {
        existingInfo.OrderNumber = informationAditional.OrderNumber;
        existingInfo.IdTypepay = informationAditional.IdTypepay;
        existingInfo.Quote = informationAditional.Quote;
        existingInfo.IdConditionspay = informationAditional.IdConditionspay;
        existingInfo.PurchaseOrder = informationAditional.PurchaseOrder;
        existingInfo.IdTypemoney = informationAditional.IdTypemoney;
        existingInfo.NumberEntry = informationAditional.NumberEntry;
        existingInfo.FolioFiscal = informationAditional.FolioFiscal;
        existingInfo.Active = informationAditional.Active;

        await _context.SaveChangesAsync();
        return existingInfo;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error updating additional information with IdIncorexp {IdIncorexp}", idInExp);
        throw;
    }
}

public async Task<bool> DeleteAsync(int idInExp)
{
    var existingInfo = await _context.InformationAditionals
        .FirstOrDefaultAsync(ia => ia.IdIncorexp == idInExp && ia.Active == true);
    if (existingInfo == null)
    {
        _logger.LogWarning("Attempted to delete non-existent additional information with IdIncorexp {IdIncorexp}", idInExp);
        return false;
    }

    try
    {
        existingInfo.Active = false;
        await _context.SaveChangesAsync();
        return true;
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error deleting additional information with IdIncorexp {IdIncorexp}", idInExp);
        throw;
    }
}
    }

    public interface IInformationAditionalService
    {
        Task<List<InformationAditional>> GetAll(int idInExp);
        Task<InformationAditional?> GetByIdAsync(int id);
        Task SaveAsync(InformationAditional informationAditional);
        Task<InformationAditional?> UpdateAsync(int idInExp, InformationAditional informationAditional);
        Task<bool> DeleteAsync(int idInExp);
    }

}