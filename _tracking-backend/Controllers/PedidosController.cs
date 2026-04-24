using MicroServicioTracking.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PedidosController : ControllerBase
    {
        private readonly DbTrackingContext _context;
        private readonly ILogger<PedidosController> _logger;

        public PedidosController(DbTrackingContext context, ILogger<PedidosController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<List<Pedido>>> GetAll(int? idCompany)
        {
            try
            {
                var query = _context.Pedidos.AsQueryable();

                if (idCompany.HasValue)
                {
                    query = query.Where(p => p.IdCompany == idCompany.Value);
                }

                var pedidos = await query.ToListAsync();

                if (pedidos == null || !pedidos.Any())
                {
                    _logger.LogWarning("No pedidos found");
                    return NotFound(new { Message = "No pedidos found", Data = new List<Pedido>() });
                }

                return Ok(new
                {
                    Message = "Pedidos retrieved successfully",
                    Count = pedidos.Count,
                    Data = pedidos
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pedidos");
                return StatusCode(500, "An error occurred while retrieving pedidos");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Pedido>> GetById(int id)
        {
            try
            {
                var pedido = await _context.Pedidos.FindAsync(id);

                if (pedido == null)
                {
                    _logger.LogWarning("Pedido not found with ID {Id}", id);
                    return NotFound(new { Message = "Pedido not found", Id = id });
                }

                return Ok(new
                {
                    Message = "Pedido retrieved successfully",
                    Data = pedido
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the pedido");
            }
        }

        [HttpGet("by-company/{idCompany}")]
        public async Task<ActionResult<List<Pedido>>> GetByCompany(int idCompany)
        {
            try
            {
                var pedidos = await _context.Pedidos
                    .Where(p => p.IdCompany == idCompany)
                    .ToListAsync();

                if (pedidos == null || !pedidos.Any())
                {
                    _logger.LogWarning("No pedidos found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No pedidos found for the specified company", IdCompany = idCompany, Data = new List<Pedido>() });
                }

                return Ok(new
                {
                    Message = "Pedidos retrieved successfully",
                    IdCompany = idCompany,
                    Count = pedidos.Count,
                    Data = pedidos
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pedidos for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving pedidos");
            }
        }

        [HttpGet("by-company-numero/{idCompany}/{numero}")]
        public async Task<ActionResult<Pedido>> GetByCompanyAndNumero(int idCompany, string numero)
        {
            try
            {
                var pedido = await _context.Pedidos
                    .FirstOrDefaultAsync(p => p.IdCompany == idCompany && p.Numero == numero);

                if (pedido == null)
                {
                    _logger.LogWarning("Pedido not found with IdCompany {IdCompany} and Numero {Numero}", idCompany, numero);
                    return NotFound(new { Message = "Pedido not found", IdCompany = idCompany, Numero = numero });
                }

                return Ok(new
                {
                    Message = "Pedido retrieved successfully",
                    Data = pedido
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving pedido with IdCompany {IdCompany} and Numero {Numero}", idCompany, numero);
                return StatusCode(500, "An error occurred while retrieving the pedido");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Pedido>> Create([FromBody] Pedido pedido)
        {
            try
            {
                if (pedido == null)
                {
                    return BadRequest(new { Message = "Pedido data is required" });
                }

                _context.Pedidos.Add(pedido);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Pedido created successfully with ID {Id}", pedido.Id);

                return CreatedAtAction(nameof(GetById), new { id = pedido.Id }, new
                {
                    Message = "Pedido created successfully",
                    Id = pedido.Id,
                    Data = pedido
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating pedido");
                return StatusCode(500, "An error occurred while creating the pedido");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] Pedido pedido)
        {
            try
            {
                if (id != pedido.Id)
                {
                    return BadRequest(new { Message = "ID mismatch between URL and body" });
                }

                var existingPedido = await _context.Pedidos.FindAsync(id);
                if (existingPedido == null)
                {
                    _logger.LogWarning("Pedido not found for update with ID {Id}", id);
                    return NotFound(new { Message = "Pedido not found", Id = id });
                }

                existingPedido.IdCompany = pedido.IdCompany;
                existingPedido.Numero = pedido.Numero;
                existingPedido.Fecha = pedido.Fecha;
                existingPedido.NumArticulos = pedido.NumArticulos;
                existingPedido.Comentario = pedido.Comentario;
                existingPedido.Active = pedido.Active;
                existingPedido.Banco = pedido.Banco;
                existingPedido.TotalPagarBanco = pedido.TotalPagarBanco;
                existingPedido.Impuesto = pedido.Impuesto;

                await _context.SaveChangesAsync();

                _logger.LogInformation("Pedido updated successfully with ID {Id}", id);

                return Ok(new
                {
                    Message = "Pedido updated successfully",
                    Id = id,
                    Data = existingPedido
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating pedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the pedido");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var pedido = await _context.Pedidos.FindAsync(id);

                if (pedido == null)
                {
                    _logger.LogWarning("Pedido not found for deletion with ID {Id}", id);
                    return NotFound(new { Message = "Pedido not found", Id = id });
                }

                _context.Pedidos.Remove(pedido);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Pedido deleted successfully with ID {Id}", id);

                return Ok(new
                {
                    Message = "Pedido deleted successfully",
                    Id = id
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting pedido with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the pedido");
            }
        }
    }
}
