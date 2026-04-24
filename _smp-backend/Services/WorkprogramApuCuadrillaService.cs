using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    // DTO que devuelve cuadrilla + sus items en una sola llamada
    public class CuadrillaConItems
    {
        public int    Id           { get; set; }
        public int    IdWorkprogram { get; set; }
        public string Name         { get; set; } = string.Empty;
        public decimal Cantidad    { get; set; }
        public int    SortOrder    { get; set; }
        public List<WorkprogramApuCuadrillaItem> Items { get; set; } = new();
    }

    public class WorkprogramApuCuadrillaService : IWorkprogramApuCuadrillaService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<WorkprogramApuCuadrillaService> _logger;

        public WorkprogramApuCuadrillaService(DbSmpContext context, ILogger<WorkprogramApuCuadrillaService> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger  = logger  ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<List<CuadrillaConItems>> GetByWorkprogram(int idWorkprogram)
        {
            try
            {
                var cuadrillas = await _context.WorkprogramApuCuadrillas
                    .Where(c => c.IdWorkprogram == idWorkprogram && c.Active)
                    .OrderBy(c => c.SortOrder).ThenBy(c => c.Id)
                    .AsNoTracking()
                    .ToListAsync();

                var ids = cuadrillas.Select(c => c.Id).ToList();

                var items = await _context.WorkprogramApuCuadrillaItems
                    .Where(i => ids.Contains(i.IdCuadrilla) && i.Active)
                    .AsNoTracking()
                    .ToListAsync();

                return cuadrillas.Select(c => new CuadrillaConItems
                {
                    Id            = c.Id,
                    IdWorkprogram = c.IdWorkprogram,
                    Name          = c.Name,
                    Cantidad      = c.Cantidad,
                    SortOrder     = c.SortOrder,
                    Items         = items.Where(i => i.IdCuadrilla == c.Id).ToList(),
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving cuadrillas for workprogram {Id}", idWorkprogram);
                throw;
            }
        }

        public async Task<WorkprogramApuCuadrilla> SaveCuadrilla(WorkprogramApuCuadrilla cuadrilla)
        {
            try
            {
                cuadrilla.Id = 0;
                _context.WorkprogramApuCuadrillas.Add(cuadrilla);
                await _context.SaveChangesAsync();
                return cuadrilla;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving cuadrilla");
                throw;
            }
        }

        public async Task<WorkprogramApuCuadrilla?> UpdateCuadrilla(int id, WorkprogramApuCuadrilla cuadrilla)
        {
            var existing = await _context.WorkprogramApuCuadrillas.FindAsync(id);
            if (existing == null) return null;

            try
            {
                existing.Name      = cuadrilla.Name;
                existing.Cantidad  = cuadrilla.Cantidad;
                existing.SortOrder = cuadrilla.SortOrder;
                await _context.SaveChangesAsync();
                return existing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cuadrilla {Id}", id);
                throw;
            }
        }

        public async Task<bool> DeleteCuadrilla(int id)
        {
            var existing = await _context.WorkprogramApuCuadrillas.FindAsync(id);
            if (existing == null) return false;

            try
            {
                // Soft-delete items primero
                var items = await _context.WorkprogramApuCuadrillaItems
                    .Where(i => i.IdCuadrilla == id).ToListAsync();
                items.ForEach(i => i.Active = false);

                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting cuadrilla {Id}", id);
                throw;
            }
        }

        public async Task<WorkprogramApuCuadrillaItem> SaveItem(WorkprogramApuCuadrillaItem item)
        {
            try
            {
                item.Id = 0;
                _context.WorkprogramApuCuadrillaItems.Add(item);
                await _context.SaveChangesAsync();
                return item;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving cuadrilla item");
                throw;
            }
        }

        public async Task<WorkprogramApuCuadrillaItem?> UpdateItem(int id, WorkprogramApuCuadrillaItem item)
        {
            var existing = await _context.WorkprogramApuCuadrillaItems.FindAsync(id);
            if (existing == null) return null;

            try
            {
                existing.IdReference  = item.IdReference;
                existing.Description  = item.Description;
                existing.Unit         = item.Unit;
                existing.Quantity     = item.Quantity;
                existing.UnitCost     = item.UnitCost;
                await _context.SaveChangesAsync();
                return existing;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating cuadrilla item {Id}", id);
                throw;
            }
        }

        public async Task<bool> DeleteItem(int id)
        {
            var existing = await _context.WorkprogramApuCuadrillaItems.FindAsync(id);
            if (existing == null) return false;

            try
            {
                existing.Active = false;
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting cuadrilla item {Id}", id);
                throw;
            }
        }
    }

    public interface IWorkprogramApuCuadrillaService
    {
        Task<List<CuadrillaConItems>> GetByWorkprogram(int idWorkprogram);
        Task<WorkprogramApuCuadrilla>  SaveCuadrilla(WorkprogramApuCuadrilla cuadrilla);
        Task<WorkprogramApuCuadrilla?> UpdateCuadrilla(int id, WorkprogramApuCuadrilla cuadrilla);
        Task<bool> DeleteCuadrilla(int id);
        Task<WorkprogramApuCuadrillaItem>  SaveItem(WorkprogramApuCuadrillaItem item);
        Task<WorkprogramApuCuadrillaItem?> UpdateItem(int id, WorkprogramApuCuadrillaItem item);
        Task<bool> DeleteItem(int id);
    }
}
