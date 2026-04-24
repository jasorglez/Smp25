using Microsoft.EntityFrameworkCore;
using SMP.Models;
using SMP.Models.context;

namespace SMP.Services
{
    // ── DTOs ──────────────────────────────────────────────────────────────────
    public class AuxiliarDetalleResponse
    {
        public List<AuxiliarItem> Items { get; set; } = new();
        public List<AuxiliarCuadrillaConItems> Cuadrillas { get; set; } = new();
    }

    public class AuxiliarCuadrillaConItems
    {
        public int Id { get; set; }
        public int IdAuxiliar { get; set; }
        public string Name { get; set; } = string.Empty;
        public decimal Cantidad { get; set; } = 1;
        public int SortOrder { get; set; }
        public bool Active { get; set; } = true;
        public List<AuxiliarCuadrillaItem> Items { get; set; } = new();
    }

    // ── Service ───────────────────────────────────────────────────────────────
    public class AuxiliarItemsService : IAuxiliarItemsService
    {
        private readonly DbSmpContext _context;
        private readonly ILogger<AuxiliarItemsService> _logger;

        public AuxiliarItemsService(DbSmpContext context, ILogger<AuxiliarItemsService> logger)
        {
            _context = context;
            _logger  = logger;
        }

        public async Task<AuxiliarDetalleResponse> GetDetalle(int idAuxiliar)
        {
            var items = await _context.AuxiliarItems
                .Where(i => i.IdAuxiliar == idAuxiliar && i.Active)
                .AsNoTracking().ToListAsync();

            var cuadrillas = await _context.AuxiliarCuadrillas
                .Where(c => c.IdAuxiliar == idAuxiliar && c.Active)
                .OrderBy(c => c.SortOrder)
                .AsNoTracking().ToListAsync();

            var cuadrillaIds = cuadrillas.Select(c => c.Id).ToList();
            var cuadrillaItems = await _context.AuxiliarCuadrillaItems
                .Where(i => cuadrillaIds.Contains(i.IdCuadrilla) && i.Active)
                .AsNoTracking().ToListAsync();

            return new AuxiliarDetalleResponse
            {
                Items = items,
                Cuadrillas = cuadrillas.Select(c => new AuxiliarCuadrillaConItems
                {
                    Id         = c.Id,
                    IdAuxiliar = c.IdAuxiliar,
                    Name       = c.Name,
                    Cantidad   = c.Cantidad,
                    SortOrder  = c.SortOrder,
                    Active     = c.Active,
                    Items      = cuadrillaItems.Where(i => i.IdCuadrilla == c.Id).ToList()
                }).ToList()
            };
        }

        // ── Items (MATERIAL / HERR / EQUIPO) ──────────────────────────────────
        public async Task<AuxiliarItem> SaveItem(AuxiliarItem item)
        {
            item.Id = 0;
            _context.AuxiliarItems.Add(item);
            await _context.SaveChangesAsync();
            return item;
        }

        public async Task<bool> UpdateItem(int id, AuxiliarItem item)
        {
            var existing = await _context.AuxiliarItems.FindAsync(id);
            if (existing == null) return false;
            existing.Type        = item.Type;
            existing.IdReference = item.IdReference;
            existing.Description = item.Description;
            existing.Unit        = item.Unit;
            existing.Quantity    = item.Quantity;
            existing.UnitCost    = item.UnitCost;
            existing.Active      = item.Active;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteItem(int id)
        {
            var existing = await _context.AuxiliarItems.FindAsync(id);
            if (existing == null) return false;
            existing.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }

        // ── Cuadrillas ────────────────────────────────────────────────────────
        public async Task<AuxiliarCuadrilla> SaveCuadrilla(AuxiliarCuadrilla c)
        {
            c.Id = 0;
            _context.AuxiliarCuadrillas.Add(c);
            await _context.SaveChangesAsync();
            return c;
        }

        public async Task<bool> UpdateCuadrilla(int id, AuxiliarCuadrilla c)
        {
            var existing = await _context.AuxiliarCuadrillas.FindAsync(id);
            if (existing == null) return false;
            existing.Name      = c.Name;
            existing.Cantidad  = c.Cantidad;
            existing.SortOrder = c.SortOrder;
            existing.Active    = c.Active;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteCuadrilla(int id)
        {
            var existing = await _context.AuxiliarCuadrillas.FindAsync(id);
            if (existing == null) return false;
            existing.Active = false;
            var items = await _context.AuxiliarCuadrillaItems
                .Where(i => i.IdCuadrilla == id).ToListAsync();
            items.ForEach(i => i.Active = false);
            await _context.SaveChangesAsync();
            return true;
        }

        // ── Cuadrilla Items ───────────────────────────────────────────────────
        public async Task<AuxiliarCuadrillaItem> SaveCuadrillaItem(AuxiliarCuadrillaItem item)
        {
            item.Id = 0;
            _context.AuxiliarCuadrillaItems.Add(item);
            await _context.SaveChangesAsync();
            return item;
        }

        public async Task<bool> UpdateCuadrillaItem(int id, AuxiliarCuadrillaItem item)
        {
            var existing = await _context.AuxiliarCuadrillaItems.FindAsync(id);
            if (existing == null) return false;
            existing.IdReference = item.IdReference;
            existing.Description = item.Description;
            existing.Unit        = item.Unit;
            existing.Quantity    = item.Quantity;
            existing.UnitCost    = item.UnitCost;
            existing.Active      = item.Active;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteCuadrillaItem(int id)
        {
            var existing = await _context.AuxiliarCuadrillaItems.FindAsync(id);
            if (existing == null) return false;
            existing.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
    }

    public interface IAuxiliarItemsService
    {
        Task<AuxiliarDetalleResponse> GetDetalle(int idAuxiliar);
        Task<AuxiliarItem> SaveItem(AuxiliarItem item);
        Task<bool> UpdateItem(int id, AuxiliarItem item);
        Task<bool> DeleteItem(int id);
        Task<AuxiliarCuadrilla> SaveCuadrilla(AuxiliarCuadrilla c);
        Task<bool> UpdateCuadrilla(int id, AuxiliarCuadrilla c);
        Task<bool> DeleteCuadrilla(int id);
        Task<AuxiliarCuadrillaItem> SaveCuadrillaItem(AuxiliarCuadrillaItem item);
        Task<bool> UpdateCuadrillaItem(int id, AuxiliarCuadrillaItem item);
        Task<bool> DeleteCuadrillaItem(int id);
    }
}
