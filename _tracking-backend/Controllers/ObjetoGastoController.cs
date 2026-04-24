using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Models.Palacio;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Mvc;
using static MicroServicioTracking.Services.ObjetoGastoService;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ObjetoGastoController : ControllerBase
    {
        private readonly IObjetoGastoService _objetoGastoService;
        private readonly ILogger<ObjetoGastoController> _logger;

        public ObjetoGastoController(
            IObjetoGastoService objetoGastoService,
            ILogger<ObjetoGastoController> logger)
        {
            _objetoGastoService = objetoGastoService ?? throw new ArgumentNullException(nameof(objetoGastoService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

   
        [HttpGet("getAll/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGasto>>> GetAll(int idCompany)
        {
            try
            {
                var objetosGasto = await _objetoGastoService.GetAll(idCompany);
                if (objetosGasto == null || !objetosGasto.Any())
                {
                    _logger.LogWarning("No ObjetoGasto found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No objetos de gasto found", IdCompany = idCompany });
                }

                return Ok(objetosGasto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving objetos de gasto.");
            }
        }

        [HttpGet("nivel4/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGasto>>> GetAllNivel(int idCompany)
        {
            try
            {
                var objetosGasto = await _objetoGastoService.GetGastosNivel(idCompany);
                if (objetosGasto == null || !objetosGasto.Any())
                {
                    _logger.LogWarning("No ObjetoGasto found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No objetos de gasto found", IdCompany = idCompany });
                }

                return Ok(objetosGasto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving objetos de gasto.");
            }
        }


        /// <summary>
        /// Obtiene objetos de gasto por nivel
        /// </summary>
        [HttpGet("getByNivel/{idCompany}/{nivel}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGasto>>> GetByNivel(int idCompany, int nivel)
        {
            try
            {
                var objetosGasto = await _objetoGastoService.GetByNivel(idCompany, nivel);
                if (objetosGasto == null || !objetosGasto.Any())
                {
                    _logger.LogWarning("No ObjetoGasto found for company {IdCompany} and nivel {Nivel}", idCompany, nivel);
                    return NotFound(new { Message = "No objetos de gasto found", IdCompany = idCompany, Nivel = nivel });
                }

                return Ok(objetosGasto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto by nivel for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving objetos de gasto.");
            }
        }

        /// <summary>
        /// Obtiene solo los objetos de gasto hoja (nivel 4) que pueden recibir movimientos
        /// </summary>
        [HttpGet("getHojas/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGasto>>> GetHojas(int idCompany)
        {
            try
            {
                var objetosGasto = await _objetoGastoService.GetHojas(idCompany);
                if (objetosGasto == null || !objetosGasto.Any())
                {
                    _logger.LogWarning("No Hojas ObjetoGasto found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No objetos de gasto hojas found", IdCompany = idCompany });
                }

                return Ok(objetosGasto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Hojas ObjetoGasto for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving objetos de gasto hojas.");
            }
        }

        /// <summary>
        /// Obtiene la jerarquía completa de objetos de gasto en formato plano ordenado
        /// </summary>
        [HttpGet("getHierarchy/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGastoHierarchyDto>>> GetHierarchy(int idCompany)
        {
            try
            {
                var hierarchy = await _objetoGastoService.GetHierarchy(idCompany);
                if (hierarchy == null || !hierarchy.Any())
                {
                    _logger.LogWarning("No hierarchy found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No hierarchy found", IdCompany = idCompany });
                }

                _logger.LogInformation("Retrieved {Count} hierarchy items for company {IdCompany}", hierarchy.Count, idCompany);
                return Ok(new
                {
                    Message = "Hierarchy retrieved successfully",
                    Count = hierarchy.Count,
                    IdCompany = idCompany,
                    Data = hierarchy
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving the hierarchy.");
            }
        }

        /// <summary>
        /// Obtiene la jerarquía en formato de árbol anidado
        /// </summary>
        [HttpGet("getTree/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGastoTreeDto>>> GetTree(int idCompany)
        {
            try
            {
                var tree = await _objetoGastoService.GetTree(idCompany);
                if (tree == null || !tree.Any())
                {
                    _logger.LogWarning("No tree found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No tree found", IdCompany = idCompany });
                }

                return Ok(tree);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tree for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving the tree.");
            }
        }

        /// <summary>
        /// Obtiene la jerarquía con montos acumulados (opcionalmente filtrado por fechas)
        /// </summary>
        [HttpGet("getHierarchyWithAmounts/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<ObjetoGastoHierarchyDto>>> GetHierarchyWithAmounts(
            int idCompany,
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin)
        {
            try
            {
                var hierarchy = await _objetoGastoService.GetHierarchyWithAmounts(idCompany, fechaInicio, fechaFin);
                if (hierarchy == null || !hierarchy.Any())
                {
                    _logger.LogWarning("No hierarchy with amounts found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No hierarchy found", IdCompany = idCompany });
                }

                return Ok(new
                {
                    Message = "Hierarchy with amounts retrieved successfully",
                    Count = hierarchy.Count,
                    IdCompany = idCompany,
                    FechaInicio = fechaInicio,
                    FechaFin = fechaFin,
                    Data = hierarchy
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving hierarchy with amounts for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving the hierarchy with amounts.");
            }
        }

        /// <summary>
        /// Obtiene un objeto de gasto por ID
        /// </summary>
        [HttpGet("getById/{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ObjetoGasto>> GetById(int id)
        {
            try
            {
                var objetoGasto = await _objetoGastoService.GetById(id);
                if (objetoGasto == null)
                {
                    _logger.LogWarning("ObjetoGasto with ID {Id} not found", id);
                    return NotFound(new { Message = "Objeto de gasto not found", Id = id });
                }

                return Ok(objetoGasto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving ObjetoGasto with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the objeto de gasto.");
            }
        }

        /// <summary>
        /// Crea un nuevo objeto de gasto
        /// </summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<ObjetoGasto>> Create([FromBody] ObjetoGasto objetoGasto)
        {
            try
            {
                if (objetoGasto == null)
                {
                    return BadRequest(new { Message = "Invalid objeto de gasto data" });
                }

                var createdObjetoGasto = await _objetoGastoService.Save(objetoGasto);

                return CreatedAtAction(
                    nameof(GetById),
                    new { id = createdObjetoGasto.Id },
                    createdObjetoGasto
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating ObjetoGasto");
                return StatusCode(500, "An error occurred while creating the objeto de gasto.");
            }
        }

        /// <summary>
        /// Actualiza un objeto de gasto existente
        /// </summary>
        [HttpPut("update/{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Update(int id, [FromBody] ObjetoGasto objetoGasto)
        {
            try
            {
                if (objetoGasto == null)
                {
                    return BadRequest(new { Message = "Invalid objeto de gasto data" });
                }

                var success = await _objetoGastoService.Update(id, objetoGasto);
                if (!success)
                {
                    return NotFound(new { Message = "Objeto de gasto not found", Id = id });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating ObjetoGasto with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the objeto de gasto.");
            }
        }

        /// <summary>
        /// Elimina (desactiva) un objeto de gasto
        /// </summary>
        [HttpDelete("delete/{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _objetoGastoService.Delete(id);
                if (!success)
                {
                    return NotFound(new { Message = "Objeto de gasto not found", Id = id });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting ObjetoGasto with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the objeto de gasto.");
            }
        }

        [HttpGet("getNivel4PorCodigoNivel1/{idCompany}/{codigoNivel1}")]
        public async Task<ActionResult<List<ObjetoGastoNivel4Dto>>> GetNivel4PorCodigoNivel1(
     int idCompany,
     string codigoNivel1)
        {
            var nivel4Items = await _objetoGastoService
                .GetNivel4PorCodigoNivel1(idCompany, codigoNivel1);

            return Ok(nivel4Items);
        }


    }
}
