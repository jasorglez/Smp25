
using MicroServicioTracking.Models;
using Microsoft.EntityFrameworkCore;


namespace MicroServicioTracking.Services
{
    public class TrackingService : ITrackingService
    {
        private readonly DbTrackingContext context;
        private readonly ILogger<TrackingService> _logger;

        public TrackingService(DbTrackingContext dbContext, ILogger<TrackingService> logger)
        {
            context = dbContext ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<IQueryable<Tracking>> GetTrackings()
        {
            return context.Trackings.AsNoTracking();
        }

        public async Task Save(Tracking tracking)
        {
            try
            {
                context.Trackings.Add(tracking);
                await context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Registra o maneja el error según tus necesidades
                _logger.LogInformation($"Error al guardar: {ex.Message}");
            }
        }

        public async Task SaveTracking(string company, DateTime dateTime, string description, string origin, string user)
        {
            var tracking = new Tracking
            {
                Company = company,
                Datet = dateTime,
                Description = description,
                Origin = origin,
                User = user
            };

            _logger.LogInformation($"Saving tracking for company {company}");
            await Save(tracking);
            _logger.LogInformation($"Tracking saved successfully for {company}");
        }

        public async Task<List<Tracking>> GetTrackingId(int id)
        {
            var tracking = await context.Trackings
                .Where(t => t.Id == id)
                .AsNoTracking()
                .ToListAsync();

            return tracking;
        }


    }


    public interface ITrackingService
    {
        Task<IQueryable<Tracking>> GetTrackings();
        Task Save(Tracking tracking);
        Task SaveTracking(string company, DateTime dateTime, string description, string origin, string user);
        Task<List<Tracking>> GetTrackingId(int id);

    }
}
