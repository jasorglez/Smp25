using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Authorization;

namespace SMP.Hubs

{
    //[Authorize]
    //[EnableCors("SignalRCorsPolicy")]
    public class StorageHub : Hub
    {
        private readonly ILogger<StorageHub> _logger;

        public StorageHub(ILogger<StorageHub> logger)
        {
            _logger = logger;
        }

        // Método específico para notificar nuevos reportes
        public async Task NotifyNewDailyReport(object reportData)
        {
            _logger.LogInformation($"Notificando nuevo reporte diario: {reportData}");
            await Clients.All.SendAsync("ReceiveNewDailyReport", reportData);
        }

        // Método para notificar a un grupo específico (por proyecto o OT)
        public async Task NotifyNewDailyReportToGroup(string groupName, object reportData)
        {
            _logger.LogInformation($"Notificando nuevo reporte diario al grupo {groupName}: {reportData}");
            await Clients.Group(groupName).SendAsync("ReceiveNewDailyReport", reportData);
        }
    
        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation($"Cliente conectado: {Context.ConnectionId}");
            _logger.LogInformation($"User Agent: {Context.GetHttpContext()?.Request.Headers["User-Agent"]}");
            _logger.LogInformation($"Origin: {Context.GetHttpContext()?.Request.Headers["Origin"]}");
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception exception)
        {
            _logger.LogInformation($"Cliente desconectado: {Context.ConnectionId}");
            if (exception != null)
            {
                _logger.LogError(exception, "Error durante la desconexión");
            }
            await base.OnDisconnectedAsync(exception);
        }

        public async Task SendMessage(string user, string message)
        {
            _logger.LogInformation($"Mensaje recibido de {user}: {message}");
            await Clients.All.SendAsync("ReceiveMessage", user, message);
        }

        public async Task TriggerUpdate(string message)
        {
            _logger.LogInformation($"Update disparado: {message}");
            await Clients.All.SendAsync("ReceiveUpdate", message);
        }

        public async Task JoinGroup(string groupName)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation($"Cliente {Context.ConnectionId} agregado al grupo {groupName}");
        }

        public async Task LeaveGroup(string groupName)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, groupName);
            _logger.LogInformation($"Cliente {Context.ConnectionId} removido del grupo {groupName}");
        }

    }
}