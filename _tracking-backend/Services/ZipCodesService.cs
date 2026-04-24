using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class ZipCodesService : IZipCodesService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<ZipCodesService> _logger;

    public ZipCodesService(DbTrackingContext context, ILogger<ZipCodesService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<ActionResult<List<ZipCodes>>> GetInfoByZipCode(string cp)
    {
        try
        {
            var resultados = await _context.ZipCodes
                .Where(z => z.Cp == cp)
                .AsNoTracking()
                .ToListAsync();

            return resultados;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving info for CP {Cp}", cp);
            return new StatusCodeResult(500);
        }
    }
}
public interface IZipCodesService
{
    Task<ActionResult<List<ZipCodes>>> GetInfoByZipCode(string cp);
}