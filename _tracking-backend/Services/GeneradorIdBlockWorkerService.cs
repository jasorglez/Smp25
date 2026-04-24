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
    public class GeneradorIdBlockWorkerService : IGeneradorIdBlockWorkerService
    {
        private readonly ILogger<GeneradorIdBlockWorkerService> _logger;
        private readonly DbTrackingContext _context;

        public GeneradorIdBlockWorkerService(ILogger<GeneradorIdBlockWorkerService> logger, DbTrackingContext context)
        {
            _logger = logger;
            _context = context;
        }

        public async Task GenerateAutomaticIdBlock()
        {
            var today = DateTime.Today;
            string currentYear = today.Year.ToString().Substring(2, 2);

            _logger.LogInformation("📅 Ejecutando generación de bloques {date}", today);

            var blocksEndingToday = await _context.IdBlockPeriods
                .Where(b => b.EndDate == today)
                .ToListAsync();

            foreach (var block in blocksEndingToday)
            {
                int branchId = block.IdBranch;
                string lastBlock = block.BlockPeriodCode;
                DateTime lastEndDate = block.EndDate;

                _logger.LogInformation("🔧 Procesando sucursal {branch}", branchId);

                var payrollPeriod = await _context.HRManagement
                    .Where(s => s.IdBranch == branchId)
                    .Select(s => s.PayrollPeriod)
                    .FirstOrDefaultAsync();

                if (payrollPeriod == null)
                {
                    _logger.LogWarning("⚠️ No se encontró período de nómina para sucursal {branch}", branchId);
                    continue;
                }

                string pronombre, lastYear, number;

                if (lastBlock.Contains("-"))
                {
                    int hyphenPos = lastBlock.IndexOf('-');
                    pronombre = lastBlock.Substring(0, hyphenPos);
                    lastYear = lastBlock.Substring(hyphenPos + 1, 2);
                    number = lastBlock.Substring(hyphenPos + 3);
                }
                else
                {
                    pronombre = lastBlock.Substring(0, 2);
                    lastYear = lastBlock.Substring(2, 2);
                    number = lastBlock.Substring(4);
                }

                if (!int.TryParse(number, out int numParsed))
                {
                    _logger.LogWarning("⚠️ Número inválido en bloque {block}", lastBlock);
                    continue;
                }

                int newNumber = (lastYear == currentYear) ? numParsed + 1 : 1;
                string newNumberStr = newNumber.ToString().PadLeft(number.Length, '0');
                string newBlock = $"{pronombre}-{currentYear}{newNumberStr}";

                DateTime newStartDate = lastEndDate.AddDays(1);
                DateTime newEndDate = newStartDate.AddDays(payrollPeriod.Value - 1);

                _logger.LogInformation("✅ Nuevo bloque {block} para sucursal {branch} ({start} → {end})",
                    newBlock, branchId, newStartDate.ToShortDateString(), newEndDate.ToShortDateString());

                var newBlockEntry = new IdBlockPeriod
                {
                    IdBranch = branchId,
                    BlockPeriodCode = newBlock,
                    StartDate = newStartDate,
                    EndDate = newEndDate,
                    Active = true
                };

                _context.IdBlockPeriods.Add(newBlockEntry);
            }

            await _context.SaveChangesAsync();
        }
    }
}

namespace MicroServicioTracking.Services
{
    public interface IGeneradorIdBlockWorkerService
    {
        Task GenerateAutomaticIdBlock();
    }
}