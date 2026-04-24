using MicroServicioTracking.Models;
using MicroServicioTracking.Models.View;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Services
{
    public class IdBlockPeriodService : IIdBlockPeriodService
    {
        private readonly DbTrackingContext _context;

        public IdBlockPeriodService(DbTrackingContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task<List<IdBlockPeriod>> ObtenerPeriodByBranch(int branchId)
        {
            try
            {
                if (branchId >= 0)
                {
                    return await _context.IdBlockPeriods
                        .Where(e => e.IdBranch == branchId)
                        .OrderByDescending(e => e.Id)
                        .ToListAsync();
                }
                else
                {
                    var branches = await _context.Set<ActiveBranchIds>()
                        .Where(x => x.idCompany == -branchId)
                        .ToListAsync();

                    var branchIds = branches
                        .SelectMany(b => b.BranchIds.Split(',', StringSplitOptions.RemoveEmptyEntries))
                        .Select(s => int.Parse(s.Trim()))
                        .ToList();

                    var result = new List<IdBlockPeriod>();

                    foreach (var branchIdSelec in branchIds)
                    {
                        var blocks = await _context.IdBlockPeriods
                            .Where(c => c.IdBranch == branchIdSelec)
                            .OrderByDescending(c => c.Id)
                            .AsNoTracking()
                            .ToListAsync();

                        result.AddRange(blocks);
                    }

                    return result;
                }
            }
            catch (Exception ex)
            {
                // Aquí podrías registrar el error con _logger si lo inyectas
                throw new ApplicationException($"Error al obtener los bloques de la sucursal {branchId}", ex);
            }
        }
        public async Task<int?> GetBlockIdByBranchAndDateAsync(int idEmployee, DateTime date)
        {
            var targetDate = date.Date; // Solo la fecha, sin la hora

            var branchId = await _context.Employees
                .Where(e => e.Id == idEmployee)
                .Select(e => e.IdBranch)
                .FirstOrDefaultAsync();

            var block = await _context.IdBlockPeriods
                .Where(b => b.IdBranch == branchId &&
                            b.StartDate.Date <= targetDate &&
                            b.EndDate.Date >= targetDate &&
                            b.Active)
                .OrderByDescending(b => b.StartDate)
                .FirstOrDefaultAsync();

            return block?.Id;
        }
        public async Task<int?> CreateBlockNewAsync(int branchId, string identificador, DateTime dateStart, DateTime dateEnd)
        {
            try
            {
                // Validaciones básicas
                if (dateEnd <= dateStart)
                    throw new ArgumentException("La fecha de fin debe ser posterior a la fecha de inicio");

                if (string.IsNullOrWhiteSpace(identificador))
                    throw new ArgumentException("El identificador no puede estar vacío");

                // Verificar si ya existe un bloque con fechas solapadas en la misma sucursal
                var existingBlock = await _context.IdBlockPeriods
                    .Where(b => b.IdBranch == branchId &&
                                b.Active &&
                                ((b.StartDate.Date <= dateStart.Date && b.EndDate.Date >= dateStart.Date) ||
                                 (b.StartDate.Date <= dateEnd.Date && b.EndDate.Date >= dateEnd.Date) ||
                                 (dateStart.Date <= b.StartDate.Date && dateEnd.Date >= b.EndDate.Date)))
                    .FirstOrDefaultAsync();

                if (existingBlock != null)
                    throw new InvalidOperationException($"Ya existe un identificador para esta sucurcarsal");

                // Verificar si ya existe un bloque con el mismo identificador en la sucursal
                var existingIdentifier = await _context.IdBlockPeriods
                    .Where(b => b.IdBranch == branchId &&
                                b.BlockPeriodCode == identificador &&
                                b.Active)
                    .FirstOrDefaultAsync();
            
                if (existingIdentifier != null)
                    throw new InvalidOperationException($"Ya existe un bloque activo con el identificador '{identificador}' en esta sucursal");

                // Crear el nuevo bloque
                var newBlock = new IdBlockPeriod
                {
                    IdBranch = branchId,
                    BlockPeriodCode = identificador,
                    StartDate = dateStart.Date,
                    EndDate = dateEnd.Date,
                    Active = true
                };

                _context.IdBlockPeriods.Add(newBlock);
                await _context.SaveChangesAsync();

                return newBlock.Id;
            }
            catch (Exception ex)
            {
                throw new ApplicationException($"Error al crear el bloque de período: {ex.Message}", ex);
            }
        }



    }
}



namespace MicroServicioTracking.Services
{
    public interface IIdBlockPeriodService
    {
        Task<List<IdBlockPeriod>> ObtenerPeriodByBranch(int branchId);
        Task<int?> GetBlockIdByBranchAndDateAsync(int branchId, DateTime date);
        Task<int?> CreateBlockNewAsync(int branchId, string identificador, DateTime dateStart, DateTime dateEnd);
    }
}
