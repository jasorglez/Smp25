using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class IdBlockGeneratorWorker : BackgroundService
{
    private readonly ILogger<IdBlockGeneratorWorker> _logger;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly TimeSpan _interval = TimeSpan.FromMinutes(10);

    public IdBlockGeneratorWorker(ILogger<IdBlockGeneratorWorker> logger,
                                  IServiceScopeFactory scopeFactory)
    {
        _logger = logger;
        _scopeFactory = scopeFactory;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var service = scope.ServiceProvider.GetRequiredService<GeneradorIdBlockWorkerService>();
                await service.GenerateAutomaticIdBlock();

                _logger.LogInformation("✔️ Bloques generados automáticamente.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al generar bloques.");
            }

            await Task.Delay(_interval, stoppingToken);
        }
    }
}

}
namespace MicroServicioTracking.Services
{
    public interface IIdBlockGeneratorWorker
    {
        Task ExecuteAsync();
    }
}