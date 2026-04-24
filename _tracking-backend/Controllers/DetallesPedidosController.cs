using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class DetallesPedidosController : ControllerBase
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<DetallesPedidosController> _logger;

        public DetallesPedidosController(DbTrackingContext context, ILogger<DetallesPedidosController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<DetallesPedido>>> GetAll()
        {
            try
            {
                var detalles = await _context.DetallesPedidos.ToListAsync();

                if (detalles == null || !detalles.Any())
                {
                    _logger.LogWarning("No detallespedidos found");
                    return NotFound(new { Message = "No detallespedidos found", Data = new List<DetallesPedido>() });
                }

                return Ok(new
                {
                    Message = "DetallesPedidos retrieved successfully",
                    Count = detalles.Count,
                    Data = detalles
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detallespedidos");
                return StatusCode(500, "An error occurred while retrieving detallespedidos");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<DetallesPedido>> GetById(int id)
        {
            try
            {
                var detalle = await _context.DetallesPedidos.FindAsync(id);

                if (detalle == null)
                {
                    _logger.LogWarning("DetallesPedido not found with ID {Id}", id);
                    return NotFound(new { Message = "DetallesPedido not found", Id = id });
                }

                return Ok(new
                {
                    Message = "DetallesPedido retrieved successfully",
                    Data = detalle
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detallespedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the detallespedido");
            }
        }

        [HttpGet("by-cliente/{idCliente}")]
        public async Task<ActionResult<List<DetallesPedido>>> GetByCliente(int idCliente)
        {
            try
            {
                var detalles = await _context.DetallesPedidos
                    .Where(d => d.IdCliente == idCliente)
                    .ToListAsync();

                if (detalles == null || !detalles.Any())
                {
                    _logger.LogWarning("No detallespedidos found for cliente {IdCliente}", idCliente);
                    return NotFound(new { Message = "No detallespedidos found for the specified cliente", IdCliente = idCliente, Data = new List<DetallesPedido>() });
                }

                return Ok(new
                {
                    Message = "DetallesPedidos retrieved successfully",
                    IdCliente = idCliente,
                    Count = detalles.Count,
                    Data = detalles
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detallespedidos for cliente {IdCliente}", idCliente);
                return StatusCode(500, "An error occurred while retrieving detallespedidos");
            }
        }

        [HttpGet("by-company/{idCompany}")]
        public async Task<ActionResult<List<DetallesPedido>>> GetByCompany(int idCompany)
        {
            try
            {
                var detalles = await _context.DetallesPedidos
                    .Where(d => _context.Pedidos.Any(p => p.Id == d.IdPedido && p.IdCompany == idCompany))
                    .ToListAsync();

                return Ok(new
                {
                    Message = "DetallesPedidos retrieved successfully",
                    IdCompany = idCompany,
                    Count = detalles.Count,
                    Data = detalles
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detallespedidos for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving detallespedidos");
            }
        }

        [HttpGet("by-pedido/{idPedido}")]
        public async Task<ActionResult<List<DetallesPedido>>> GetByPedido(int idPedido)
        {
            try
            {
                var detalles = await _context.DetallesPedidos
                    .Where(d => d.IdPedido == idPedido)
                    .GroupJoin(
                        _context.Customers.AsNoTracking(),
                        detalle => detalle.IdCliente,
                        customer => customer.Id,
                        (detalle, customers) => new { detalle, customer = customers.FirstOrDefault() }
                    )
                    .Select(x => new
                    {
                        x.detalle.Id,
                        x.detalle.IdPedido,
                        x.detalle.IdCliente,
                        clienteName = (
                            ((x.customer != null ? x.customer.NameContact : null) ?? "").Trim() +
                            (
                                !string.IsNullOrWhiteSpace(x.customer != null ? x.customer.NameContact : null) &&
                                !string.IsNullOrWhiteSpace(x.customer != null ? x.customer.Company : null)
                                    ? " / "
                                    : ""
                            ) +
                            ((x.customer != null ? x.customer.Company : null) ?? "").Trim()
                        ).Trim(),
                        x.detalle.Producto,
                        x.detalle.Cantidad,
                        x.detalle.Plataforma,
                        x.detalle.AplicaImpuestos,
                        x.detalle.Costo,
                        x.detalle.Venta,
                        x.detalle.Impuesto,
                        x.detalle.Estado,
                        x.detalle.Comentario,
                        x.detalle.Active
                    })
                    .ToListAsync();

                if (detalles == null || !detalles.Any())
                {
                    _logger.LogWarning("No detallespedidos found for pedido {IdPedido}", idPedido);
                    return Ok(new { Message = "No detallespedidos found for the specified pedido", IdPedido = idPedido, Data = new List<DetallesPedido>() });
                }

                return Ok(new
                {
                    Message = "DetallesPedidos retrieved successfully",
                    IdPedido = idPedido,
                    Count = detalles.Count,
                    Data = detalles
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving detallespedidos for pedido {IdPedido}", idPedido);
                return StatusCode(500, "An error occurred while retrieving detallespedidos");
            }
        }

        [HttpPost]
        public async Task<ActionResult<DetallesPedido>> Create([FromBody] DetallesPedido detalle)
        {
            try
            {
                if (detalle == null)
                {
                    return BadRequest(new { Message = "DetallesPedido data is required" });
                }

                _context.DetallesPedidos.Add(detalle);
                await _context.SaveChangesAsync();

                // Actualizar numArticulos en Pedido
                if (detalle.IdPedido.HasValue)
                {
                    var pedido = await _context.Pedidos.FindAsync(detalle.IdPedido.Value);
                    if (pedido != null)
                    {
                        var count = await _context.DetallesPedidos.CountAsync(d => d.IdPedido == detalle.IdPedido.Value);
                        pedido.NumArticulos = count;
                        await _context.SaveChangesAsync();
                    }
                }

                _logger.LogInformation("DetallesPedido created successfully with ID {Id}", detalle.Id);

                return CreatedAtAction(nameof(GetById), new { id = detalle.Id }, new
                {
                    Message = "DetallesPedido created successfully",
                    Id = detalle.Id,
                    Data = detalle
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating detallespedido");
                return StatusCode(500, "An error occurred while creating the detallespedido");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] DetallesPedido detalle)
        {
            try
            {
                if (id != detalle.Id)
                {
                    return BadRequest(new { Message = "ID mismatch between URL and body" });
                }

                var existingDetalle = await _context.DetallesPedidos.FindAsync(id);
                if (existingDetalle == null)
                {
                    _logger.LogWarning("DetallesPedido not found for update with ID {Id}", id);
                    return NotFound(new { Message = "DetallesPedido not found", Id = id });
                }

                existingDetalle.IdPedido = detalle.IdPedido;
                existingDetalle.IdCliente = detalle.IdCliente;
                existingDetalle.Producto = detalle.Producto;
                existingDetalle.Cantidad = detalle.Cantidad;
                existingDetalle.Plataforma = detalle.Plataforma;
                existingDetalle.AplicaImpuestos = detalle.AplicaImpuestos;
                existingDetalle.Costo = detalle.Costo;
                existingDetalle.Venta = detalle.Venta;
                existingDetalle.Impuesto = detalle.Impuesto;
                existingDetalle.Estado = detalle.Estado;
                existingDetalle.Comentario = detalle.Comentario;
                existingDetalle.Active = detalle.Active;

                await _context.SaveChangesAsync();

                _logger.LogInformation("DetallesPedido updated successfully with ID {Id}", id);

                return Ok(new
                {
                    Message = "DetallesPedido updated successfully",
                    Id = id,
                    Data = existingDetalle
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating detallespedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the detallespedido");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var detalle = await _context.DetallesPedidos.FindAsync(id);

                if (detalle == null)
                {
                    _logger.LogWarning("DetallesPedido not found for deletion with ID {Id}", id);
                    return NotFound(new { Message = "DetallesPedido not found", Id = id });
                }

                var idPedido = detalle.IdPedido;

                _context.DetallesPedidos.Remove(detalle);
                await _context.SaveChangesAsync();

                // Actualizar numArticulos en Pedido
                if (idPedido.HasValue)
                {
                    var pedido = await _context.Pedidos.FindAsync(idPedido.Value);
                    if (pedido != null)
                    {
                        var count = await _context.DetallesPedidos.CountAsync(d => d.IdPedido == idPedido.Value);
                        pedido.NumArticulos = count;
                        await _context.SaveChangesAsync();
                    }
                }

                _logger.LogInformation("DetallesPedido deleted successfully with ID {Id}", id);

                return Ok(new
                {
                    Message = "DetallesPedido deleted successfully",
                    Id = id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting detallespedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the detallespedido");
            }
        }
    }
}
