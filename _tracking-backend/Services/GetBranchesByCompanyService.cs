// Servicio para consultar el listado de branches por compañia

using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services;

public class GetBranchesByCompanyService : IGetBranchesByCompanyService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<GetBranchesByCompanyService> _logger;

    public GetBranchesByCompanyService(
        DbTrackingContext context,
        ILogger<GetBranchesByCompanyService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<BranchesApiData>> GetBranchesData(int idCompany)
    {
        try
        {
            var userBranchPermission = await _context.Allbranchs
                .Where(x => x.Id_Company == idCompany)
                .ToListAsync();  // Primero traemos los datos

            // Ahora aplicamos DistinctBy en memoria
            userBranchPermission = userBranchPermission
                .DistinctBy(x => x.Id)
                .ToList();

            var combined = userBranchPermission.Select(x => new BranchesApiData
            {
                Id = x.Id,
                IdUser = x.Id_User,
                Type = x.Type,
                Name = x.Name
            }).ToList();

            Console.WriteLine($"-----------CombinedData: {JsonSerializer.Serialize(combined)}");

            return combined;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener y combinar datos");
            throw;
        }
    }

}

public interface IGetBranchesByCompanyService
{
    Task<List<BranchesApiData>> GetBranchesData(int idCompany);
}