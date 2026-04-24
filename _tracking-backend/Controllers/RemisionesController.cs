using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.View;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RemisionesController : ControllerBase
    {
        private const string EstadoAbierta = "ABIERTA";
        private const string EstadoCerrada = "CERRADA";
        private const string EstadoRemision = "REMISION";
        private const string EstadoEntregado = "ENTREGADO";

        private readonly DbTrackingContext _context;
        private readonly ILogger<RemisionesController> _logger;

        public RemisionesController(DbTrackingContext context, ILogger<RemisionesController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet("resumen")]
        public async Task<ActionResult<IEnumerable<LogisticaRemisionResumen>>> GetResumen([FromQuery] int idCompany, [FromQuery] string? estado)
        {
            try
            {
                var query = _context.LogisticaRemisionesResumen
                    .AsNoTracking()
                    .Where(x => x.IdCompany == idCompany);

                if (!string.IsNullOrWhiteSpace(estado))
                {
                    var estadoNormalized = estado.Trim().ToUpperInvariant();
                    query = query.Where(x => x.Estado != null && x.Estado.ToUpper() == estadoNormalized);
                }

                var data = await query
                    .OrderByDescending(x => x.FechaCreacion)
                    .ToListAsync();

                return Ok(new
                {
                    Message = "Resumen de remisiones obtenido correctamente",
                    Count = data.Count,
                    Data = data
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving remisiones resumen for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving remisiones resumen");
            }
        }

        [HttpGet("cliente")]
        public async Task<ActionResult<IEnumerable<LogisticaRemisionResumen>>> GetByCliente([FromQuery] int idCompany, [FromQuery] int idCliente, [FromQuery] string? estado)
        {
            try
            {
                var query = _context.LogisticaRemisionesResumen
                    .AsNoTracking()
                    .Where(x => x.IdCompany == idCompany && x.IdCliente == idCliente);

                if (!string.IsNullOrWhiteSpace(estado))
                {
                    var estadoNormalized = estado.Trim().ToUpperInvariant();
                    query = query.Where(x => x.Estado != null && x.Estado.ToUpper() == estadoNormalized);
                }

                var data = await query
                    .OrderByDescending(x => x.FechaCreacion)
                    .ToListAsync();

                return Ok(new
                {
                    Message = "Remisiones del cliente obtenidas correctamente",
                    Count = data.Count,
                    Data = data
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving remisiones for company {IdCompany} and cliente {IdCliente}", idCompany, idCliente);
                return StatusCode(500, "An error occurred while retrieving remisiones by cliente");
            }
        }

        [HttpGet("{idRemision:int}/detalle")]
        public async Task<ActionResult> GetDetalle(int idRemision)
        {
            try
            {
                var remision = await _context.Remisiones
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == idRemision && x.Active);

                if (remision == null)
                {
                    return NotFound(new { Message = "Remisión no encontrada", IdRemision = idRemision });
                }

                var detalles = await (
                    from rd in _context.RemisionesDetalle.AsNoTracking()
                    join dp in _context.DetallesPedidos.AsNoTracking() on rd.IdDetallePedido equals dp.Id
                    where rd.IdRemision == idRemision && rd.Active
                    select new
                    {
                        rd.Id,
                        rd.IdRemision,
                        rd.IdDetallePedido,
                        rd.CantidadRemitida,
                        rd.Comentario,
                        rd.FechaCreacion,
                        dp.IdPedido,
                        dp.IdCliente,
                        dp.Producto,
                        dp.Cantidad,
                        dp.Plataforma,
                        dp.Costo,
                        dp.Venta,
                        dp.Impuesto,
                        dp.Estado
                    }
                ).ToListAsync();

                return Ok(new
                {
                    Message = "Detalle de remisión obtenido correctamente",
                    Data = new
                    {
                        Remision = remision,
                        Detalles = detalles
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detalle for remision {IdRemision}", idRemision);
                return StatusCode(500, "An error occurred while retrieving remision detalle");
            }
        }

        [HttpPost("open")]
        public async Task<ActionResult<Remision>> CreateOrReuseOpen([FromBody] CreateOrReuseRemisionRequest request)
        {
            if (request == null || request.IdCompany <= 0 || request.IdCliente <= 0)
            {
                return BadRequest(new { Message = "IdCompany e IdCliente son obligatorios" });
            }

            try
            {
                var remision = await GetOrCreateOpenRemisionAsync(request.IdCompany, request.IdCliente, request.CreatedBy, request.Comentario);

                return Ok(new
                {
                    Message = "Remisión abierta obtenida correctamente",
                    Data = remision
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating or reusing remision for company {IdCompany} and cliente {IdCliente}", request.IdCompany, request.IdCliente);
                return StatusCode(500, "An error occurred while creating or reusing remision");
            }
        }

        [HttpPost("detalle")]
        public async Task<ActionResult> AddDetalle([FromBody] AddRemisionDetalleRequest request)
        {
            if (request == null || request.IdCompany <= 0 || request.IdCliente <= 0 || request.IdDetallePedido <= 0 || request.CantidadRemitida <= 0)
            {
                return BadRequest(new { Message = "Datos inválidos para agregar a remisión" });
            }

            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var detallePedido = await _context.DetallesPedidos.FirstOrDefaultAsync(x => x.Id == request.IdDetallePedido);
                if (detallePedido == null)
                {
                    return NotFound(new { Message = "Detalle de pedido no encontrado", IdDetallePedido = request.IdDetallePedido });
                }

                if (detallePedido.IdCliente != request.IdCliente)
                {
                    return BadRequest(new { Message = "El detalle de pedido no corresponde al cliente indicado" });
                }

                var pedido = detallePedido.IdPedido.HasValue
                    ? await _context.Pedidos.FirstOrDefaultAsync(x => x.Id == detallePedido.IdPedido.Value)
                    : null;

                if (pedido == null || pedido.IdCompany != request.IdCompany)
                {
                    return BadRequest(new { Message = "El detalle de pedido no corresponde a la empresa indicada" });
                }

                var remision = await GetOrCreateOpenRemisionAsync(request.IdCompany, request.IdCliente, request.CreatedBy, request.Comentario);

                var remisionDetalle = await _context.RemisionesDetalle
                    .FirstOrDefaultAsync(x => x.IdRemision == remision.Id && x.IdDetallePedido == request.IdDetallePedido && x.Active);

                if (remisionDetalle == null)
                {
                    remisionDetalle = new RemisionDetalle
                    {
                        IdRemision = remision.Id,
                        IdDetallePedido = request.IdDetallePedido,
                        CantidadRemitida = request.CantidadRemitida,
                        Comentario = request.Comentario,
                        FechaCreacion = DateTime.Now,
                        Active = true
                    };

                    _context.RemisionesDetalle.Add(remisionDetalle);
                }
                else
                {
                    remisionDetalle.CantidadRemitida += request.CantidadRemitida;
                    if (!string.IsNullOrWhiteSpace(request.Comentario))
                    {
                        remisionDetalle.Comentario = request.Comentario;
                    }
                }

                detallePedido.Estado = EstadoRemision;

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = "Detalle agregado a remisión correctamente",
                    Data = new
                    {
                        Remision = remision,
                        RemisionDetalle = remisionDetalle
                    }
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error adding detalle {IdDetallePedido} to remision", request.IdDetallePedido);
                return StatusCode(500, "An error occurred while adding detalle to remision");
            }
        }

        [HttpPost("{idRemision:int}/close")]
        public async Task<ActionResult> Close(int idRemision, [FromBody] CloseRemisionRequest? request)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var remision = await _context.Remisiones.FirstOrDefaultAsync(x => x.Id == idRemision && x.Active);
                if (remision == null)
                {
                    return NotFound(new { Message = "Remisión no encontrada", IdRemision = idRemision });
                }

                if (!string.Equals(remision.Estado, EstadoAbierta, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { Message = "La remisión ya no está abierta", IdRemision = idRemision, Estado = remision.Estado });
                }

                var detallesActivos = await _context.RemisionesDetalle
                    .Where(x => x.IdRemision == idRemision && x.Active)
                    .ToListAsync();

                if (detallesActivos.Count == 0)
                {
                    return BadRequest(new { Message = "La remisión debe tener al menos un detalle activo para cerrarse" });
                }

                remision.Estado = EstadoCerrada;
                remision.FechaCierre = DateTime.Now;
                remision.ClosedBy = request?.ClosedBy;
                if (!string.IsNullOrWhiteSpace(request?.Comentario))
                {
                    remision.Comentario = request.Comentario;
                }

                var detallePedidoIds = detallesActivos
                    .Select(x => x.IdDetallePedido)
                    .Distinct()
                    .ToList();

                var detallesPedido = await _context.DetallesPedidos
                    .Where(x => detallePedidoIds.Contains(x.Id))
                    .ToListAsync();

                foreach (var detallePedido in detallesPedido)
                {
                    var totalRemitido = await _context.RemisionesDetalle
                        .Where(x => x.IdDetallePedido == detallePedido.Id && x.Active)
                        .SumAsync(x => (decimal?)x.CantidadRemitida) ?? 0m;

                    var cantidadObjetivo = Convert.ToDecimal(detallePedido.Cantidad);
                    detallePedido.Estado = totalRemitido >= cantidadObjetivo ? EstadoEntregado : EstadoRemision;
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new
                {
                    Message = "Remisión cerrada correctamente",
                    Data = remision
                });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error closing remision {IdRemision}", idRemision);
                return StatusCode(500, "An error occurred while closing remision");
            }
        }

        private async Task<Remision> GetOrCreateOpenRemisionAsync(int idCompany, int idCliente, string? createdBy, string? comentario)
        {
            var remision = await _context.Remisiones
                .FirstOrDefaultAsync(x =>
                    x.IdCompany == idCompany &&
                    x.IdCliente == idCliente &&
                    x.Active &&
                    x.Estado == EstadoAbierta);

            if (remision != null)
            {
                if (!string.IsNullOrWhiteSpace(comentario) && string.IsNullOrWhiteSpace(remision.Comentario))
                {
                    remision.Comentario = comentario;
                    await _context.SaveChangesAsync();
                }

                return remision;
            }

            remision = new Remision
            {
                IdCompany = idCompany,
                IdCliente = idCliente,
                Folio = BuildFolio(idCompany),
                FechaCreacion = DateTime.Now,
                Estado = EstadoAbierta,
                Comentario = comentario,
                CreatedBy = createdBy,
                Active = true
            };

            _context.Remisiones.Add(remision);
            await _context.SaveChangesAsync();
            return remision;
        }

        private static string BuildFolio(int idCompany)
        {
            return $"REM-{idCompany}-{DateTime.Now:yyMMddHHmmssfff}";
        }
    }
}
