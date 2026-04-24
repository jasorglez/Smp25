using Microsoft.EntityFrameworkCore;
using MicroServicioTracking.Models;
using System.Text.Json.Serialization;

namespace MicroServicioTracking.Services
{
    // ── DTOs ─────────────────────────────────────────────────────────────────

    public class PresupuestoDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }
        [JsonPropertyName("id_project")]
        public int IdProject { get; set; }
        [JsonPropertyName("numrevision")]
        public int Numrevision { get; set; }
        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;
        [JsonPropertyName("motivo")]
        public string? Motivo { get; set; }
        [JsonPropertyName("fecha_inicio")]
        public DateTime? FechaInicio { get; set; }
        [JsonPropertyName("fecha_fin")]
        public DateTime? FechaFin { get; set; }
        [JsonPropertyName("vigente")]
        public bool Vigente { get; set; }
        [JsonPropertyName("usuario_responsable")]
        public string? UsuarioResponsable { get; set; }
        [JsonPropertyName("id_version_anterior")]
        public int? IdVersionAnterior { get; set; }
        [JsonPropertyName("idCompany")]
        public int IdCompany { get; set; }
        [JsonPropertyName("fecha_creacion")]
        public DateTime FechaCreacion { get; set; }
        [JsonPropertyName("active")]
        public bool Active { get; set; }
        [JsonPropertyName("monto_total")]
        public decimal MontoTotal { get; set; }
        [JsonPropertyName("proyecto_nombre")]
        public string? ProyectoNombre { get; set; }
    }

    public class PresupuestoForm
    {
        [JsonPropertyName("id_project")]
        public int IdProject { get; set; }
        [JsonPropertyName("numrevision")]
        public int Numrevision { get; set; }
        [JsonPropertyName("nombre")]
        public string Nombre { get; set; } = string.Empty;
        [JsonPropertyName("motivo")]
        public string? Motivo { get; set; }
        [JsonPropertyName("fecha_inicio")]
        public DateTime? FechaInicio { get; set; }
        [JsonPropertyName("fecha_fin")]
        public DateTime? FechaFin { get; set; }
        [JsonPropertyName("vigente")]
        public bool Vigente { get; set; }
        [JsonPropertyName("usuario_responsable")]
        public string? UsuarioResponsable { get; set; }
        [JsonPropertyName("idCompany")]
        public int IdCompany { get; set; }
        [JsonPropertyName("active")]
        public bool Active { get; set; }
    }

    public class PresupuestoLineaDto
    {
        [JsonPropertyName("id")]
        public int Id { get; set; }
        [JsonPropertyName("id_presupuesto")]
        public int IdPresupuesto { get; set; }
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }
        [JsonPropertyName("descripcion")]
        public string? Descripcion { get; set; }
        [JsonPropertyName("monto")]
        public decimal Monto { get; set; }
        [JsonPropertyName("active")]
        public bool Active { get; set; }
        [JsonPropertyName("cuenta_codigo")]
        public string? CuentaCodigo { get; set; }
        [JsonPropertyName("cuenta_nombre")]
        public string? CuentaNombre { get; set; }
        [JsonPropertyName("cuenta_nivel")]
        public int? CuentaNivel { get; set; }
        [JsonPropertyName("monto_preregistrado")]
        public decimal MontoPreregistrado { get; set; }
        [JsonPropertyName("monto_ejecutado")]
        public decimal MontoEjecutado { get; set; }
        [JsonPropertyName("saldo_disponible")]
        public decimal SaldoDisponible { get; set; }
        [JsonPropertyName("pct_ejecucion")]
        public decimal PctEjecucion { get; set; }
    }

    public class PresupuestoLineaForm
    {
        [JsonPropertyName("id_presupuesto")]
        public int IdPresupuesto { get; set; }
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }
        [JsonPropertyName("descripcion")]
        public string? Descripcion { get; set; }
        [JsonPropertyName("monto")]
        public decimal Monto { get; set; }
        [JsonPropertyName("active")]
        public bool Active { get; set; }
    }

    public class MigracionForm
    {
        [JsonPropertyName("id_presupuesto_vigente")]
        public int IdPresupuestoVigente { get; set; }
        [JsonPropertyName("id_cuenta_origen")]
        public int IdCuentaOrigen { get; set; }
        [JsonPropertyName("id_cuenta_destino")]
        public int IdCuentaDestino { get; set; }
        [JsonPropertyName("monto_transferido")]
        public decimal MontoTransferido { get; set; }
        [JsonPropertyName("motivo")]
        public string Motivo { get; set; } = string.Empty;
        [JsonPropertyName("usuario")]
        public string Usuario { get; set; } = string.Empty;
        [JsonPropertyName("idCompany")]
        public int IdCompany { get; set; }
    }

    public class IncrementoForm
    {
        [JsonPropertyName("id_presupuesto")]
        public int IdPresupuesto { get; set; }
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }
        [JsonPropertyName("monto_solicitado")]
        public decimal MontoSolicitado { get; set; }
        [JsonPropertyName("motivo")]
        public string? Motivo { get; set; }
        [JsonPropertyName("usuario_solicito")]
        public string? UsuarioSolicito { get; set; }
    }

    public class ReporteDesempenoDto
    {
        [JsonPropertyName("id_cuenta")]
        public int IdCuenta { get; set; }
        [JsonPropertyName("cuenta_codigo")]
        public string CuentaCodigo { get; set; } = string.Empty;
        [JsonPropertyName("cuenta_nombre")]
        public string CuentaNombre { get; set; } = string.Empty;
        [JsonPropertyName("cuenta_nivel")]
        public int CuentaNivel { get; set; }
        [JsonPropertyName("monto_planado")]
        public decimal MontoPlanado { get; set; }
        [JsonPropertyName("monto_ejecutado")]
        public decimal MontoEjecutado { get; set; }
        [JsonPropertyName("monto_preregistrado")]
        public decimal MontoPreregistrado { get; set; }
        [JsonPropertyName("variacion")]
        public decimal Variacion { get; set; }
        [JsonPropertyName("pct_ejecucion")]
        public decimal PctEjecucion { get; set; }
    }

    // ── Interface ─────────────────────────────────────────────────────────────

    public interface IPresupuestoService
    {
        Task<List<PresupuestoDto>> GetAll(int idCompany, int idProject);
        Task<PresupuestoDto?> GetVigente(int idCompany, int idProject);
        Task<PresupuestoDto?> GetById(int id);
        Task<Presupuesto> Create(PresupuestoForm data);
        Task<bool> Update(int id, PresupuestoForm data);
        Task<bool> SetVigente(int id, int idCompany, int idProject);
        Task<bool> Delete(int id);

        Task<List<PresupuestoLineaDto>> GetLineas(int idPresupuesto);
        Task<PresupuestoLinea> CreateLinea(PresupuestoLineaForm data);
        Task<bool> UpdateLinea(int id, PresupuestoLineaForm data);
        Task<bool> DeleteLinea(int id);

        Task<List<PresupuestoMes>> GetMeses(int idLinea);
        Task<bool> SaveMeses(int idLinea, List<PresupuestoMes> meses);

        Task<List<PreregistroGasto>> GetPreregistros(int idCompany, int idProject);
        Task<PreregistroGasto> CreatePreregistro(PreregistroGasto data);
        Task<bool> UpdatePreregistro(int id, PreregistroGasto data);
        Task<bool> DeletePreregistro(int id);

        Task<List<PresupuestoMigracion>> GetMigraciones(int idPresupuesto);
        Task<Presupuesto?> EjecutarMigracion(MigracionForm data);

        Task<List<PresupuestoIncremento>> GetIncrementos(int idPresupuesto);
        Task<PresupuestoIncremento> SolicitarIncremento(IncrementoForm data);
        Task<bool> AutorizarIncremento(int id, string usuario);
        Task<bool> RechazarIncremento(int id, string usuario);

        Task<List<ReporteDesempenoDto>> GetReporteDesempeno(int idCompany, int idProject);
        Task<decimal> GetSaldoDisponible(int idCompany, int idProject, int idCuenta);
    }

    // ── Implementation ────────────────────────────────────────────────────────

    public class PresupuestoService : IPresupuestoService
    {
        private readonly DbTrackingContext _context;

        public PresupuestoService(DbTrackingContext context)
        {
            _context = context;
        }

        // ── PRESUPUESTO HEADER ────────────────────────────────────────────────

        public async Task<List<PresupuestoDto>> GetAll(int idCompany, int idProject)
        {
            var presupuestos = await _context.Presupuestos
                .Where(p => p.IdCompany == idCompany && p.IdProject == idProject && p.Active)
                .OrderByDescending(p => p.Numrevision)
                .AsNoTracking()
                .ToListAsync();

            var result = new List<PresupuestoDto>();
            foreach (var p in presupuestos)
            {
                var montoTotal = await _context.PresupuestoLineas
                    .Where(l => l.IdPresupuesto == p.Id && l.Active)
                    .SumAsync(l => l.Monto);

                result.Add(MapToDto(p, montoTotal));
            }
            return result;
        }

        public async Task<PresupuestoDto?> GetVigente(int idCompany, int idProject)
        {
            var p = await _context.Presupuestos
                .Where(x => x.IdCompany == idCompany && x.IdProject == idProject && x.Vigente && x.Active)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (p == null) return null;

            var montoTotal = await _context.PresupuestoLineas
                .Where(l => l.IdPresupuesto == p.Id && l.Active)
                .SumAsync(l => l.Monto);

            return MapToDto(p, montoTotal);
        }

        public async Task<PresupuestoDto?> GetById(int id)
        {
            var p = await _context.Presupuestos.FindAsync(id);
            if (p == null || !p.Active) return null;

            var montoTotal = await _context.PresupuestoLineas
                .Where(l => l.IdPresupuesto == p.Id && l.Active)
                .SumAsync(l => l.Monto);

            return MapToDto(p, montoTotal);
        }

        public async Task<Presupuesto> Create(PresupuestoForm data)
        {
            var entity = new Presupuesto
            {
                IdProject = data.IdProject,
                Numrevision = data.Numrevision,
                Nombre = data.Nombre,
                Motivo = data.Motivo,
                FechaInicio = data.FechaInicio,
                FechaFin = data.FechaFin,
                Vigente = data.Vigente,
                UsuarioResponsable = data.UsuarioResponsable,
                IdCompany = data.IdCompany,
                Active = data.Active,
                FechaCreacion = DateTime.Now
            };

            if (data.Vigente)
            {
                await ClearVigente(data.IdCompany, data.IdProject);
            }

            _context.Presupuestos.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> Update(int id, PresupuestoForm data)
        {
            var entity = await _context.Presupuestos.FindAsync(id);
            if (entity == null) return false;

            entity.Nombre = data.Nombre;
            entity.Motivo = data.Motivo;
            entity.FechaInicio = data.FechaInicio;
            entity.FechaFin = data.FechaFin;
            entity.UsuarioResponsable = data.UsuarioResponsable;
            entity.Active = data.Active;

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> SetVigente(int id, int idCompany, int idProject)
        {
            await ClearVigente(idCompany, idProject);
            var entity = await _context.Presupuestos.FindAsync(id);
            if (entity == null) return false;
            entity.Vigente = true;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> Delete(int id)
        {
            var entity = await _context.Presupuestos.FindAsync(id);
            if (entity == null) return false;
            entity.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }

        // ── LÍNEAS ────────────────────────────────────────────────────────────

        public async Task<List<PresupuestoLineaDto>> GetLineas(int idPresupuesto)
        {
            var lineas = await _context.PresupuestoLineas
                .Where(l => l.IdPresupuesto == idPresupuesto && l.Active)
                .AsNoTracking()
                .ToListAsync();

            var cuentaIds = lineas.Select(l => l.IdCuenta).Distinct().ToList();
            var cuentas = await _context.CuentasContables
                .Where(c => cuentaIds.Contains(c.Id))
                .AsNoTracking()
                .ToListAsync();

            var presupuesto = await _context.Presupuestos.FindAsync(idPresupuesto);
            int idProject = presupuesto?.IdProject ?? 0;
            int idCompany = presupuesto?.IdCompany ?? 0;

            var result = new List<PresupuestoLineaDto>();
            foreach (var l in lineas)
            {
                var cuenta = cuentas.FirstOrDefault(c => c.Id == l.IdCuenta);
                var preregistrado = await _context.PreregistroGastos
                    .Where(p => p.IdProject == idProject && p.IdCuenta == l.IdCuenta && p.IdCompany == idCompany && p.Active)
                    .SumAsync(p => p.Monto);

                var ejecutado = await _context.Incomeandexpenses
                    .Where(i => i.IdProject == idProject && i.IdCuentaContable == l.IdCuenta && i.Type == "E" && i.Active == true)
                    .SumAsync(i => (decimal?)i.Total ?? 0);

                var saldo = l.Monto - ejecutado - preregistrado;
                var pct = l.Monto > 0 ? Math.Round(ejecutado / l.Monto * 100, 2) : 0;

                result.Add(new PresupuestoLineaDto
                {
                    Id = l.Id,
                    IdPresupuesto = l.IdPresupuesto,
                    IdCuenta = l.IdCuenta,
                    Descripcion = l.Descripcion,
                    Monto = l.Monto,
                    Active = l.Active,
                    CuentaCodigo = cuenta?.Codigo,
                    CuentaNombre = cuenta?.Nombre,
                    CuentaNivel = cuenta?.Nivel,
                    MontoPreregistrado = preregistrado,
                    MontoEjecutado = ejecutado,
                    SaldoDisponible = saldo,
                    PctEjecucion = pct
                });
            }
            return result;
        }

        public async Task<PresupuestoLinea> CreateLinea(PresupuestoLineaForm data)
        {
            var entity = new PresupuestoLinea
            {
                IdPresupuesto = data.IdPresupuesto,
                IdCuenta = data.IdCuenta,
                Descripcion = data.Descripcion,
                Monto = data.Monto,
                Active = data.Active
            };
            _context.PresupuestoLineas.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> UpdateLinea(int id, PresupuestoLineaForm data)
        {
            var entity = await _context.PresupuestoLineas.FindAsync(id);
            if (entity == null) return false;
            entity.IdCuenta = data.IdCuenta;
            entity.Descripcion = data.Descripcion;
            entity.Monto = data.Monto;
            entity.Active = data.Active;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteLinea(int id)
        {
            var entity = await _context.PresupuestoLineas.FindAsync(id);
            if (entity == null) return false;
            entity.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }

        // ── DISTRIBUCIÓN MENSUAL ──────────────────────────────────────────────

        public async Task<List<PresupuestoMes>> GetMeses(int idLinea)
        {
            return await _context.PresupuestoMeses
                .Where(m => m.IdLinea == idLinea && m.Active)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<bool> SaveMeses(int idLinea, List<PresupuestoMes> meses)
        {
            var existing = await _context.PresupuestoMeses
                .Where(m => m.IdLinea == idLinea)
                .ToListAsync();

            foreach (var m in meses)
            {
                var found = existing.FirstOrDefault(e => e.Mes == m.Mes && e.Anio == m.Anio);
                if (found != null)
                {
                    found.Monto = m.Monto;
                    found.Active = m.Active;
                }
                else
                {
                    _context.PresupuestoMeses.Add(new PresupuestoMes
                    {
                        IdLinea = idLinea,
                        Mes = m.Mes,
                        Anio = m.Anio,
                        Monto = m.Monto,
                        Active = m.Active
                    });
                }
            }
            await _context.SaveChangesAsync();
            return true;
        }

        // ── PREREGISTRO DE GASTO ──────────────────────────────────────────────

        public async Task<List<PreregistroGasto>> GetPreregistros(int idCompany, int idProject)
        {
            return await _context.PreregistroGastos
                .Where(p => p.IdCompany == idCompany && p.IdProject == idProject && p.Active)
                .OrderByDescending(p => p.Fecha)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<PreregistroGasto> CreatePreregistro(PreregistroGasto data)
        {
            data.FechaCreacion = DateTime.Now;
            _context.PreregistroGastos.Add(data);
            await _context.SaveChangesAsync();
            return data;
        }

        public async Task<bool> UpdatePreregistro(int id, PreregistroGasto data)
        {
            var entity = await _context.PreregistroGastos.FindAsync(id);
            if (entity == null) return false;
            entity.IdCuenta = data.IdCuenta;
            entity.Concepto = data.Concepto;
            entity.Monto = data.Monto;
            entity.Fecha = data.Fecha;
            entity.Usuario = data.Usuario;
            entity.Active = data.Active;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletePreregistro(int id)
        {
            var entity = await _context.PreregistroGastos.FindAsync(id);
            if (entity == null) return false;
            entity.Active = false;
            await _context.SaveChangesAsync();
            return true;
        }

        // ── MIGRACIONES ───────────────────────────────────────────────────────

        public async Task<List<PresupuestoMigracion>> GetMigraciones(int idPresupuesto)
        {
            return await _context.PresupuestoMigraciones
                .Where(m => m.IdPresupuestoNuevo == idPresupuesto && m.Active)
                .OrderByDescending(m => m.Fecha)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<Presupuesto?> EjecutarMigracion(MigracionForm data)
        {
            var vigente = await _context.Presupuestos.FindAsync(data.IdPresupuestoVigente);
            if (vigente == null) return null;

            // 1. Crear nuevo presupuesto (nueva versión)
            var nuevo = new Presupuesto
            {
                IdProject = vigente.IdProject,
                Numrevision = vigente.Numrevision + 1,
                Nombre = $"Rev.{vigente.Numrevision + 1}",
                Motivo = data.Motivo,
                FechaInicio = vigente.FechaInicio,
                FechaFin = vigente.FechaFin,
                Vigente = false,
                UsuarioResponsable = data.Usuario,
                IdVersionAnterior = vigente.Id,
                IdCompany = data.IdCompany,
                FechaCreacion = DateTime.Now,
                Active = true
            };
            _context.Presupuestos.Add(nuevo);
            await _context.SaveChangesAsync();

            // 2. Copiar líneas del vigente al nuevo, ajustando las 2 cuentas
            var lineasVigente = await _context.PresupuestoLineas
                .Where(l => l.IdPresupuesto == vigente.Id && l.Active)
                .AsNoTracking()
                .ToListAsync();

            foreach (var linea in lineasVigente)
            {
                decimal montoNuevo = linea.Monto;
                if (linea.IdCuenta == data.IdCuentaOrigen)
                    montoNuevo -= data.MontoTransferido;
                else if (linea.IdCuenta == data.IdCuentaDestino)
                    montoNuevo += data.MontoTransferido;

                var nuevaLinea = new PresupuestoLinea
                {
                    IdPresupuesto = nuevo.Id,
                    IdCuenta = linea.IdCuenta,
                    Descripcion = linea.Descripcion,
                    Monto = montoNuevo,
                    Active = true
                };
                _context.PresupuestoLineas.Add(nuevaLinea);
            }

            // 3. Registrar la migración
            var migracion = new PresupuestoMigracion
            {
                IdPresupuestoNuevo = nuevo.Id,
                IdCuentaOrigen = data.IdCuentaOrigen,
                IdCuentaDestino = data.IdCuentaDestino,
                MontoTransferido = data.MontoTransferido,
                Motivo = data.Motivo,
                Usuario = data.Usuario,
                Fecha = DateTime.Now,
                Active = true
            };
            _context.PresupuestoMigraciones.Add(migracion);

            // 4. Poner nuevo como vigente
            await ClearVigente(data.IdCompany, vigente.IdProject);
            nuevo.Vigente = true;

            await _context.SaveChangesAsync();
            return nuevo;
        }

        // ── INCREMENTOS ───────────────────────────────────────────────────────

        public async Task<List<PresupuestoIncremento>> GetIncrementos(int idPresupuesto)
        {
            return await _context.PresupuestoIncrementos
                .Where(i => i.IdPresupuesto == idPresupuesto && i.Active)
                .OrderByDescending(i => i.FechaSolicitud)
                .AsNoTracking()
                .ToListAsync();
        }

        public async Task<PresupuestoIncremento> SolicitarIncremento(IncrementoForm data)
        {
            var entity = new PresupuestoIncremento
            {
                IdPresupuesto = data.IdPresupuesto,
                IdCuenta = data.IdCuenta,
                MontoSolicitado = data.MontoSolicitado,
                Motivo = data.Motivo,
                Estado = "pendiente",
                UsuarioSolicito = data.UsuarioSolicito,
                FechaSolicitud = DateTime.Now,
                Active = true
            };
            _context.PresupuestoIncrementos.Add(entity);
            await _context.SaveChangesAsync();
            return entity;
        }

        public async Task<bool> AutorizarIncremento(int id, string usuario)
        {
            var entity = await _context.PresupuestoIncrementos.FindAsync(id);
            if (entity == null) return false;

            entity.Estado = "autorizado";
            entity.UsuarioAutorizo = usuario;
            entity.FechaAutorizacion = DateTime.Now;

            // Aplicar el incremento a la línea del presupuesto vigente
            var presupuesto = await _context.Presupuestos.FindAsync(entity.IdPresupuesto);
            if (presupuesto != null)
            {
                var linea = await _context.PresupuestoLineas
                    .FirstOrDefaultAsync(l => l.IdPresupuesto == entity.IdPresupuesto && l.IdCuenta == entity.IdCuenta && l.Active);

                if (linea != null)
                    linea.Monto += entity.MontoSolicitado;
            }

            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<bool> RechazarIncremento(int id, string usuario)
        {
            var entity = await _context.PresupuestoIncrementos.FindAsync(id);
            if (entity == null) return false;
            entity.Estado = "rechazado";
            entity.UsuarioAutorizo = usuario;
            entity.FechaAutorizacion = DateTime.Now;
            await _context.SaveChangesAsync();
            return true;
        }

        // ── REPORTE DE DESEMPEÑO ──────────────────────────────────────────────

        public async Task<List<ReporteDesempenoDto>> GetReporteDesempeno(int idCompany, int idProject)
        {
            var vigente = await _context.Presupuestos
                .Where(p => p.IdCompany == idCompany && p.IdProject == idProject && p.Vigente && p.Active)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (vigente == null) return new List<ReporteDesempenoDto>();

            var lineas = await _context.PresupuestoLineas
                .Where(l => l.IdPresupuesto == vigente.Id && l.Active)
                .AsNoTracking()
                .ToListAsync();

            var cuentaIds = lineas.Select(l => l.IdCuenta).Distinct().ToList();
            var cuentas = await _context.CuentasContables
                .Where(c => cuentaIds.Contains(c.Id))
                .AsNoTracking()
                .ToListAsync();

            var result = new List<ReporteDesempenoDto>();
            foreach (var l in lineas)
            {
                var cuenta = cuentas.FirstOrDefault(c => c.Id == l.IdCuenta);
                var ejecutado = await _context.Incomeandexpenses
                    .Where(i => i.IdProject == idProject && i.IdCuentaContable == l.IdCuenta && i.Type == "E" && i.Active == true)
                    .SumAsync(i => (decimal?)i.Total ?? 0);

                var preregistrado = await _context.PreregistroGastos
                    .Where(p => p.IdProject == idProject && p.IdCuenta == l.IdCuenta && p.IdCompany == idCompany && p.Active)
                    .SumAsync(p => p.Monto);

                var variacion = l.Monto - ejecutado;
                var pct = l.Monto > 0 ? Math.Round(ejecutado / l.Monto * 100, 2) : 0;

                result.Add(new ReporteDesempenoDto
                {
                    IdCuenta = l.IdCuenta,
                    CuentaCodigo = cuenta?.Codigo ?? "",
                    CuentaNombre = cuenta?.Nombre ?? "",
                    CuentaNivel = cuenta?.Nivel ?? 0,
                    MontoPlanado = l.Monto,
                    MontoEjecutado = ejecutado,
                    MontoPreregistrado = preregistrado,
                    Variacion = variacion,
                    PctEjecucion = pct
                });
            }

            return result.OrderBy(r => r.CuentaCodigo).ToList();
        }

        // ── SALDO DISPONIBLE ──────────────────────────────────────────────────

        public async Task<decimal> GetSaldoDisponible(int idCompany, int idProject, int idCuenta)
        {
            var vigente = await _context.Presupuestos
                .Where(p => p.IdCompany == idCompany && p.IdProject == idProject && p.Vigente && p.Active)
                .AsNoTracking()
                .FirstOrDefaultAsync();

            if (vigente == null) return 0;

            var linea = await _context.PresupuestoLineas
                .FirstOrDefaultAsync(l => l.IdPresupuesto == vigente.Id && l.IdCuenta == idCuenta && l.Active);

            if (linea == null) return 0;

            var ejecutado = await _context.Incomeandexpenses
                .Where(i => i.IdProject == idProject && i.IdCuentaContable == idCuenta && i.Type == "E" && i.Active == true)
                .SumAsync(i => (decimal?)i.Total ?? 0);

            var preregistrado = await _context.PreregistroGastos
                .Where(p => p.IdProject == idProject && p.IdCuenta == idCuenta && p.IdCompany == idCompany && p.Active)
                .SumAsync(p => p.Monto);

            return linea.Monto - ejecutado - preregistrado;
        }

        // ── Helpers ───────────────────────────────────────────────────────────

        private async Task ClearVigente(int idCompany, int idProject)
        {
            var current = await _context.Presupuestos
                .Where(p => p.IdCompany == idCompany && p.IdProject == idProject && p.Vigente && p.Active)
                .ToListAsync();

            foreach (var p in current)
                p.Vigente = false;
        }

        private static PresupuestoDto MapToDto(Presupuesto p, decimal montoTotal) => new()
        {
            Id = p.Id,
            IdProject = p.IdProject,
            Numrevision = p.Numrevision,
            Nombre = p.Nombre,
            Motivo = p.Motivo,
            FechaInicio = p.FechaInicio,
            FechaFin = p.FechaFin,
            Vigente = p.Vigente,
            UsuarioResponsable = p.UsuarioResponsable,
            IdVersionAnterior = p.IdVersionAnterior,
            IdCompany = p.IdCompany,
            FechaCreacion = p.FechaCreacion,
            Active = p.Active,
            MontoTotal = montoTotal
        };
    }
}
