using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.DTOs.MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.View;
using Microsoft.EntityFrameworkCore;

public class IncomeandexpenseService : IIncomeAndExpenseService
{
    private readonly DbTrackingContext _context;
    private readonly ILogger<IncomeandexpenseService> _logger;

    public IncomeandexpenseService(DbTrackingContext context, ILogger<IncomeandexpenseService> logger)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    public async Task<List<object>> GetByIncomeandexpenseAll()
    {
        try
        {
            return await _context.IncomeAndExpenseRoots
                .Where(i => i.Active == true && i.Type == "GASTO")
                .OrderByDescending(i => i.Date)                
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IncomeAndExpenses for Business");
                
            throw;
        }
    }

    public async Task<List<Incomexroot>> GetIncomxroot(int idroot)
    {
        try
        {
            return await _context.Incomexroots
                .Where(ir => ir.Idroot == idroot)
                .OrderByDescending(i => i.Fechaingreso)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Income for Business");

            throw;
        }
    }

    public async Task<List<Expensexroot>> GetExpensexroot(int idroot)
    {
        try
        {
            return await _context.Expensexroots
                .Where(e => e.Idroot == idroot)
                .OrderByDescending(ex => ex.Datestamped)
                .AsNoTracking()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving Expenses for Business");

            throw;
        }
    }



    public async Task<List<object>> GetByBusiness(int id)
    {
        try
        {
            return await _context.Incomeandexpenses
                .Where(e => e.IdBusinnes == id && e.Active )
                .OrderByDescending(e => e.DateStamped)
                .Select(e => new
                {
                    e.Id,
                    e.IdBranch,
                    e.NumberDocument,
                    e.IdBusinnes,
                    e.IdAccount,
                    e.Date,
                    e.IdCustomer,
                    e.IdExpend,e.idExpendxcategr,
                    e.Uuid,
                    e.DateStamped,
                    e.Description,
                    e.PaymentMonth,
                    e.Type,
                    e.Subtotal,e.TotalComp,
                    e.Tax,e.Isr,
                    e.Total,
                    e.CreatedBy,
                    e.CreatedAt,
                    e.ModifiedBy,
                    e.ModifiedAt,
                    e.MetodoPago,
                    e.IdCustomerBilling,
                    e.TipoComprobante,
                    e.Moneda,e.IdTypeComp,e.Oc,e.IdProject,
                    e.FormaPago,e.Mostrartodo,
                    e.LugarExpedicion,e.CountDocomps, e.CountItems,
                    e.IdBillingConfig,e.Facturado,
                    e.Status, e.Active,
                    e.IdAuthorize, e.AuthorizeName, e.AuthorizationStatus, e.RejectionReason, e.AuthorizedAt,
                    e.IdTransferRef
                })
                .AsNoTracking()
                .OrderByDescending(e => e.Date)
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IncomeAndExpenses for Business ID {Id}", id);
            throw;
        }
    }

    public async Task<List<object>> GetByBranch(int idBranch)
    {
        try
        {
            return await _context.Incomeandexpenses
                .Where(e => e.IdBranch == idBranch && e.Active)
                .OrderByDescending(e => e.DateStamped)
                .Select(e => new
                {
                    e.Id,
                    e.NumberDocument,
                    e.IdBusinnes,
                    e.IdBranch,
                    e.IdAccount,
                    e.Date,
                    e.IdCustomer,
                    e.IdExpend,
                    e.idExpendxcategr,
                    e.Uuid,
                    e.DateStamped,
                    e.Description,
                    e.PaymentMonth,
                    e.Type,
                    e.Subtotal,
                    e.Tax,
                    e.Isr,
                    e.Total,
                    e.TotalComp,
                    e.CreatedBy,
                    e.CreatedAt,
                    e.ModifiedBy,
                    e.ModifiedAt,
                    e.Status,
                    e.IdTypeComp,
                    e.MetodoPago,
                    e.IdCustomerBilling,
                    e.TipoComprobante,
                    e.FormaPago,
                    e.LugarExpedicion,
                    e.IdBillingConfig,
                    e.CountDocomps,
                    e.CountItems,e.Oc,e.IdProject,
                    e.Mostrartodo,
                    e.Moneda,e.Facturado,
                    e.Active,
                    e.IdAuthorize, e.AuthorizeName, e.AuthorizationStatus, e.RejectionReason, e.AuthorizedAt,
                    e.IdTransferRef
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IncomeAndExpenses for Branch {Id}", idBranch);
            throw;
        }
    }

    public async Task<List<object>> GetById(int id)
    {
        try
        {
            return await _context.Incomeandexpenses
                .Where(e => e.Id == id && e.Active)
                .Select(e => new
                {
                    e.Id,
                    e.NumberDocument,
                    e.IdBusinnes,
                    e.IdAccount,
                    e.Date,
                    e.IdCustomer,
                    e.IdExpend,
                    e.idExpendxcategr,
                    e.Uuid,
                    e.DateStamped,
                    e.Description,
                    e.PaymentMonth,
                    e.Type,
                    e.Subtotal,
                    e.Tax,
                    e.Isr,
                    e.TotalComp,
                    e.Total, e.MetodoPago, e.IdCustomerBilling,e.TipoComprobante, e.Moneda,
                    e.CreatedBy,e.FormaPago,e.LugarExpedicion,e.IdBillingConfig,
                    e.CreatedAt,
                    e.IdTypeComp,
                    e.ModifiedBy,
                    e.Mostrartodo,e.Oc,
                    e.CountDocomps,
                    e.CountItems,
                    e.ModifiedAt,e.Facturado,
                    e.Status, e.Active,
                    e.IdAuthorize, e.AuthorizeName, e.AuthorizationStatus, e.RejectionReason, e.AuthorizedAt,
                    e.IdTransferRef
                })
                .AsNoTracking()
                .ToListAsync<object>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving IncomeAndExpenses for Business ID {Id}", id);
            throw;
        }
    }

    public async Task<List<object>> GetBalanceStatement(int id)
    {
        try
        {
            var query = await (from ie in _context.Incomeandexpenses
                               where ie.Active == true &&
                                     ie.IdAccount == id && ie.Status == "Pagada" &&
                                     (ie.Type == "DEPOSITO" || ie.Type == "GASTO" || ie.Type == "APORTACION" || ie.Type == "PRESTAMO" || ie.Type == "RETIRO" || ie.Type == "UTILIDADES")
                               orderby ie.Date, ie.Id
                               select new
                               {
                                   ie.Id,
                                   ie.IdAccount,
                                   NumeroDocumento = ie.NumberDocument,
                                   Fecha = ie.Date.HasValue ? ie.Date.Value.ToString("yyyy-MM-dd") : "",
                                   Descripcion = ie.Description,
                                   Tipo = ie.Type,
                                   Movement = (ie.Type == "DEPOSITO" || ie.Type == "APORTACION" || ie.Type == "PRESTAMO") ? ie.Total : -ie.Total
                               })
                             .AsNoTracking()
                             .ToListAsync();

            if (!query.Any())
            {
                return new List<object>();
            }

            decimal runningBalance = 0;
            var resultList = new List<object>();

            // Calcular saldo progresivo en orden ascendente
            foreach (var r in query)
            {
                runningBalance += r.Movement;
                resultList.Add(new
                {
                    r.Id,
                    r.IdAccount,
                    r.NumeroDocumento,
                    r.Fecha,
                    r.Descripcion,
                    r.Tipo,
                    Deposito = (r.Tipo == "DEPOSITO" || r.Tipo == "APORTACION" || r.Tipo == "PRESTAMO") ? Math.Abs(r.Movement) : 0,
                    Gasto = (r.Tipo == "GASTO" || r.Tipo == "RETIRO" || r.Tipo == "UTILIDADES") ? Math.Abs(r.Movement) : 0,
                    Saldo = runningBalance
                });
            }

            // **Ahora invertimos la lista sin afectar los cálculos**
            return resultList.Reverse<object>().ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener el estado de cuenta");
            throw;
        }
    }

    public async Task<Incomeandexpense> Save(Incomeandexpense incomeAndExpense)
    {
        using var transaction = await _context.Database.BeginTransactionAsync();

        try
        {
            // 1. Obtener la cuenta bancaria con LOCK para evitar race conditions
            var account = await _context.AccountBanks
                .Where(a => a.Id == incomeAndExpense.IdAccount && a.Active)
                .FirstOrDefaultAsync();

            if (account == null)
            {
                throw new Exception($"Cuenta bancaria con ID {incomeAndExpense.IdAccount} no encontrada o inactiva");
            }

            // 2. Generar numberDocument según el tipo
            string numberDocument;
            if (incomeAndExpense.Type == "DEPOSITO")
            {
                // Usar Maskin + Consecin para INGRESOS
                if (string.IsNullOrEmpty(account.Maskin))
                {
                    throw new Exception("La cuenta bancaria no tiene configurada una máscara de ingreso (maskin)");
                }

                account.Consecin = (account.Consecin ?? 0) + 1;
                numberDocument = $"{account.Maskin}{account.Consecin.Value.ToString("D4")}"; // 4 dígitos
            }
            else if (incomeAndExpense.Type == "GASTO")
            {
                // Usar Maskex + Consecex para EGRESOS
                if (string.IsNullOrEmpty(account.Maskex))
                {
                    throw new Exception("La cuenta bancaria no tiene configurada una máscara de egreso (maskex)");
                }

                account.Consecex = (account.Consecex ?? 0) + 1;
                numberDocument = $"{account.Maskex}{account.Consecex.Value.ToString("D4")}"; // 4 dígitos
            }
            else if (incomeAndExpense.Type == "APORTACION")
            {
                // Aportación de socio: usa maskin + consecin igual que DEPOSITO
                if (string.IsNullOrEmpty(account.Maskin))
                {
                    throw new Exception("La cuenta bancaria no tiene configurada una máscara de ingreso (maskin)");
                }

                account.Consecin = (account.Consecin ?? 0) + 1;
                numberDocument = $"{account.Maskin}{account.Consecin.Value.ToString("D4")}";
            }
            else if (incomeAndExpense.Type == "RETIRO")
            {
                // Retiro de socio: usa maskex + consecex igual que GASTO
                if (string.IsNullOrEmpty(account.Maskex))
                {
                    throw new Exception("La cuenta bancaria no tiene configurada una máscara de egreso (maskex)");
                }

                account.Consecex = (account.Consecex ?? 0) + 1;
                numberDocument = $"{account.Maskex}{account.Consecex.Value.ToString("D4")}";
            }
            else if (incomeAndExpense.Type == "UTILIDADES")
            {
                // Utilidades de socio: usa maskex + consecex igual que RETIRO
                if (string.IsNullOrEmpty(account.Maskex))
                {
                    throw new Exception("La cuenta bancaria no tiene configurada una máscara de egreso (maskex)");
                }

                account.Consecex = (account.Consecex ?? 0) + 1;
                numberDocument = $"{account.Maskex}{account.Consecex.Value.ToString("D4")}";
            }
            else
            {
                throw new Exception($"Tipo de documento inválido: {incomeAndExpense.Type}. Debe ser 'DEPOSITO', 'GASTO', 'APORTACION', 'RETIRO' o 'UTILIDADES'");
            }

            // 3. Asignar el numberDocument generado
            incomeAndExpense.NumberDocument = numberDocument;

            // 4. Guardar el ingreso/egreso y actualizar la cuenta
            _context.Incomeandexpenses.Add(incomeAndExpense);
            _context.AccountBanks.Update(account);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Documento creado: {NumberDocument} | Tipo: {Type} | Cuenta: {AccountId} | Consecutivo: {Consecutive}",
                numberDocument, incomeAndExpense.Type, account.Id,
                (incomeAndExpense.Type == "DEPOSITO" || incomeAndExpense.Type == "APORTACION") ? account.Consecin : account.Consecex
            );

            return incomeAndExpense; // Retornar con el ID y numberDocument generados
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error guardando IncomeAndExpense con auto-incremento");
            throw;
        }
    }

    public async Task<Incomeandexpense?> Update(int id, Incomeandexpense incomeAndExpense)
    {
        var existingItem = await _context.Incomeandexpenses.FindAsync(id);
        if (existingItem == null)
        {
            _logger.LogWarning("Attempted to update non-existent IncomeAndExpense with ID {Id}", id);
            return null;
        }

        try
        {  
            existingItem.NumberDocument = incomeAndExpense.NumberDocument;
            existingItem.IdBusinnes     = incomeAndExpense.IdBusinnes;
            existingItem.IdCustomer     = incomeAndExpense.IdCustomer;
            existingItem.PaymentMonth  = incomeAndExpense.PaymentMonth;
            existingItem.IdBranch       = incomeAndExpense.IdBranch;
            existingItem.IdExpend       = incomeAndExpense.IdExpend;
            existingItem.idExpendxcategr = incomeAndExpense.idExpendxcategr;
            existingItem.Date           = incomeAndExpense.Date;
            existingItem.DateStamped    = incomeAndExpense.DateStamped;
            existingItem.CreatedAt      = incomeAndExpense.CreatedAt;
            existingItem.Type           = incomeAndExpense.Type;    
            existingItem.Description    = incomeAndExpense.Description; 
            existingItem.Status         = incomeAndExpense.Status;
            existingItem.Subtotal       = incomeAndExpense.Subtotal;
            existingItem.Tax            = incomeAndExpense.Tax;
            existingItem.Isr            = incomeAndExpense.Isr;
            existingItem.Total          = incomeAndExpense.Total;
            existingItem.ModifiedBy     = incomeAndExpense.ModifiedBy;
            existingItem.ModifiedAt           = DateTime.Now;
            existingItem.Status               = incomeAndExpense.Status;
            existingItem.MetodoPago           = incomeAndExpense.MetodoPago;
            existingItem.IdCustomerBilling    = incomeAndExpense.IdCustomerBilling;    
            existingItem.TipoComprobante      = incomeAndExpense.TipoComprobante;
            existingItem.Moneda               = incomeAndExpense.Moneda;
            existingItem.FormaPago            = incomeAndExpense.FormaPago;
            existingItem.LugarExpedicion      = incomeAndExpense.LugarExpedicion;    
            existingItem.IdBillingConfig      = incomeAndExpense.IdBillingConfig;   
            existingItem.Facturado            = incomeAndExpense.Facturado;
            existingItem.Uuid                 = incomeAndExpense.Uuid;
            existingItem.IdTypeComp           = incomeAndExpense.IdTypeComp;   
            existingItem.TotalComp            = incomeAndExpense.TotalComp;
            existingItem.Mostrartodo          = incomeAndExpense.Mostrartodo;
            existingItem.Oc                   = incomeAndExpense.Oc;
            existingItem.IdProject            = incomeAndExpense.IdProject;
            existingItem.CountItems           = incomeAndExpense.CountItems;
            existingItem.CountDocomps         = incomeAndExpense.CountDocomps;
            existingItem.IdTransferRef        = incomeAndExpense.IdTransferRef;

            await _context.SaveChangesAsync();
            return existingItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating IncomeAndExpense with ID {Id}", id);
            throw;
        }
    }

    public async Task<Incomeandexpense?> UpdateTotal(int id, UpdateTotalsDto totalsDto)
    {
        var existingItem = await _context.Incomeandexpenses.FindAsync(id);
        if (existingItem == null)
        {
            _logger.LogWarning("Attempted to update non-existent IncomeAndExpense with ID {Id}", id);
            return null;
        }

        try
        {

            existingItem.Subtotal   = totalsDto.Subtotal;
            existingItem.Tax        = totalsDto.Tax;
            existingItem.Total      = totalsDto.Total;
            existingItem.ModifiedBy = totalsDto.ModifiedBy;
            existingItem.ModifiedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return existingItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating IncomeAndExpense with ID {Id}", id);
            throw;
        }
    }

    public async Task<bool> Delete(int id)
    {
        var existingItem = await _context.Incomeandexpenses.FindAsync(id);
        if (existingItem == null)
        {
            _logger.LogWarning("Attempted to delete non-existent IncomeAndExpense with ID {Id}", id);
            return false;
        }

        try
        {
            existingItem.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting IncomeAndExpense with ID {Id}", id);
            throw;
        }
    }

    public async Task<Incomeandexpense?> UpdateAuthorization(int id, AuthorizationCallbackDto dto)
    {
        var existingItem = await _context.Incomeandexpenses.FindAsync(id);
        if (existingItem == null)
        {
            _logger.LogWarning("Attempted to update authorization for non-existent IncomeAndExpense with ID {Id}", id);
            return null;
        }

        try
        {
            existingItem.IdAuthorize = dto.IdAuthorize;
            existingItem.AuthorizeName = dto.AuthorizeName;
            existingItem.AuthorizationStatus = dto.Status == "APPROVED" ? "Autorizado" : "Rechazado";
            existingItem.RejectionReason = dto.RejectionReason;
            existingItem.AuthorizedAt = dto.RespondedAt;
            existingItem.Status = dto.Status == "APPROVED" ? "Autorizado" : "Rechazado";
            existingItem.ModifiedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return existingItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating authorization for IncomeAndExpense with ID {Id}", id);
            throw;
        }
    }

    public async Task<Incomeandexpense?> UpdateCounts(int id, UpdateCountsDto countsDto)
    {
        var existingItem = await _context.Incomeandexpenses.FindAsync(id);
        if (existingItem == null)
        {
            _logger.LogWarning("Attempted to update counts for non-existent IncomeAndExpense with ID {Id}", id);
            return null;
        }

        try
        {
            // Solo actualizar los campos específicos
            existingItem.CountDocomps = countsDto.CountDocomps;
            existingItem.CountItems = countsDto.CountItems;
            existingItem.ModifiedBy = countsDto.ModifiedBy;
            existingItem.ModifiedAt = DateTime.Now;

            await _context.SaveChangesAsync();
            return existingItem;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating counts for IncomeAndExpense with ID {Id}", id);
            throw;
        }
    }

    // También agrega el método a la interfaz:
    public interface IIncomeAndExpenseService
    {
        // ... otros métodos existentes ...
        Task<Incomeandexpense?> UpdateCounts(int id, UpdateCountsDto countsDto);
    }

    public async Task<List<IncomeByAccountDto>> GetIncomeByAccount(int idBusiness, string type, DateTime startDate, DateTime endDate)
    {
        try
        {
            var query = await (from i in _context.Incomeandexpenses
                               join a in _context.AccountBanks on i.IdAccount equals a.Id
                               where i.Active == true &&
                                     i.Type == type &&
                                     i.IdBusinnes == idBusiness &&
                                     i.Date >= startDate &&
                                     i.Date <= endDate
                               group i by a.NameAccount into g
                               select new IncomeByAccountDto
                               {
                                   NameAccount = g.Key,
                                   Ingresos = g.Sum(x => x.Total)
                               })
                               .AsNoTracking()
                               .ToListAsync();

            return query;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener ingresos agrupados por cuenta para Business ID {Id}", idBusiness);
            throw;
        }
    }

    public async Task<List<IncomeDetailDto>> GetIncomeDetailByAccount(int idBusiness, string type, string nameAccount, DateTime startDate, DateTime endDate)
    {
        try
        {
            var query = await (from i in _context.Incomeandexpenses
                               join a in _context.AccountBanks on i.IdAccount equals a.Id
                               where i.Active == true &&
                                     i.Type == type &&
                                     i.IdBusinnes == idBusiness &&
                                     a.NameAccount == nameAccount &&
                                     i.Date >= startDate &&
                                     i.Date <= endDate
                               orderby i.Date descending
                               select new IncomeDetailDto
                               {
                                   Date = i.Date,
                                   Total = i.Total
                               })
                               .AsNoTracking()
                               .ToListAsync();

            return query;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener detalle de ingresos por cuenta para Business ID {Id}", idBusiness);
            throw;
        }
    }

    public async Task<SaldoEIngresosDto> GetSaldoEIngresosMes(int idAccount, DateTime fechaInicio, DateTime fechaFin)
    {
        try
        {
            // Calcular SALDO INICIAL: suma de movimientos con Status="Pagada" y fecha < fechaInicio
            var movimientosAnteriores = await _context.Incomeandexpenses
                .Where(i => i.IdAccount == idAccount &&
                           i.Active == true &&
                           i.Status == "Pagada" &&
                           i.Date < fechaInicio)
                .AsNoTracking()
                .ToListAsync();

            var saldoInicial = movimientosAnteriores
                .Sum(i => (i.Type == "DEPOSITO" || i.Type == "APORTACION") ? i.Total : -i.Total);

            // Calcular INGRESOS DEL MES: depósitos + aportaciones con Status="Pagada" en el período
            var ingresosMes = await _context.Incomeandexpenses
                .Where(i => i.IdAccount == idAccount &&
                           i.Active == true &&
                           (i.Type == "DEPOSITO" || i.Type == "APORTACION") &&
                           i.Status == "Pagada" &&
                           i.Date >= fechaInicio &&
                           i.Date <= fechaFin)
                .SumAsync(i => i.Total);

            return new SaldoEIngresosDto
            {
                SaldoInicial = saldoInicial,
                IngresosMes = ingresosMes
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al obtener saldo e ingresos del mes para Account ID {IdAccount}", idAccount);
            throw;
        }
    }

}



public interface IIncomeAndExpenseService
{
    Task<List<object>> GetByIncomeandexpenseAll();
    Task<Incomeandexpense?> UpdateAuthorization(int id, AuthorizationCallbackDto dto);
    Task<Incomeandexpense?> UpdateCounts(int id, UpdateCountsDto countsDto);
    Task<List<Incomexroot>> GetIncomxroot(int idroot);
    Task<List<Expensexroot>> GetExpensexroot(int idroot);
    Task<List<object>> GetByBusiness(int id);
    Task<List<object>> GetByBranch(int idBranch);
    Task<List<object>> GetById(int id);
    Task<List<object>> GetBalanceStatement(int id);
    Task<List<IncomeByAccountDto>> GetIncomeByAccount(int idBusiness, string type, DateTime startDate, DateTime endDate);
    Task<List<IncomeDetailDto>> GetIncomeDetailByAccount(int idBusiness, string type, string nameAccount, DateTime startDate, DateTime endDate);
    Task<SaldoEIngresosDto> GetSaldoEIngresosMes(int idAccount, DateTime fechaInicio, DateTime fechaFin);
    Task<Incomeandexpense> Save(Incomeandexpense incomeAndExpense); // ✅ CAMBIADO: Ahora retorna Incomeandexpense
    Task<Incomeandexpense?> Update(int id, Incomeandexpense incomeAndExpense);
    Task<Incomeandexpense?> UpdateTotal(int id, UpdateTotalsDto totalsDto);
    Task<bool> Delete(int id);
}
