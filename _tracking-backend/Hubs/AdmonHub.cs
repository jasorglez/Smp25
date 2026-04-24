using Microsoft.AspNetCore.SignalR;

namespace MicroServicioTracking.Hubs
{
    public class AdmonHub : Hub
    {
        public async Task NotifyAdmonUpdate(string type, int idRoot)
        {
            await Clients.All.SendAsync("ReceiveAdmonUpdate", new { type, idRoot });
        }
    }
}
