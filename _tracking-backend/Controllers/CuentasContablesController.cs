using MicroServicioTracking.Models;
using MicroServicioTracking.Models.DTOs;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CuentasContablesController : ControllerBase
    {
        private readonly ICuentasContablesService _cuentasContablesService;
        private readonly ILogger<CuentasContablesController> _logger;

        public CuentasContablesController(
            ICuentasContablesService cuentasContablesService,
            ILogger<CuentasContablesController> logger)
        {
            _cuentasContablesService = cuentasContablesService ?? throw new ArgumentNullException(nameof(cuentasContablesService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Obtiene todas las cuentas contables de una compañía
        /// </summary>
        [HttpGet("getAll/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<CuentasContables>>> GetAll(int idCompany)
        {
            try
            {
                var cuentas = await _cuentasContablesService.GetAll(idCompany);
                if (cuentas == null || !cuentas.Any())
                {
                    _logger.LogWarning("No CuentasContables found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No cuentas found", IdCompany = idCompany });
                }

                return Ok(cuentas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CuentasContables for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving cuentas contables.");
            }
        }

        /// <summary>
        /// Obtiene cuentas contables por nivel
        /// </summary>
        [HttpGet("getByNivel/{idCompany}/{nivel}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<CuentasContables>>> GetByNivel(int idCompany, int nivel)
        {
            try
            {
                var cuentas = await _cuentasContablesService.GetByNivel(idCompany, nivel);
                if (cuentas == null || !cuentas.Any())
                {
                    _logger.LogWarning("No CuentasContables found for company {IdCompany} and nivel {Nivel}", idCompany, nivel);
                    return NotFound(new { Message = "No cuentas found", IdCompany = idCompany, Nivel = nivel });
                }

                return Ok(cuentas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CuentasContables by nivel for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving cuentas contables.");
            }
        }

        /// <summary>
        /// Obtiene solo las cuentas hoja (nivel 3) que pueden recibir movimientos
        /// </summary>
        [HttpGet("getHojas/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<CuentasContables>>> GetHojas(int idCompany)
        {
            try
            {
                var cuentas = await _cuentasContablesService.GetHojas(idCompany);
                if (cuentas == null || !cuentas.Any())
                {
                    _logger.LogWarning("No Hojas CuentasContables found for company {IdCompany}", idCompany);
                    return NotFound(new { Message = "No cuentas hojas found", IdCompany = idCompany });
                }

                return Ok(cuentas);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Hojas CuentasContables for company {IdCompany}", idCompany);
                return StatusCode(500, "An error occurred while retrieving cuentas hojas.");
            }
        }

        /// <summary>
        /// Obtiene la jerarquía completa de cuentas en formato plano ordenado
        /// </summary>
        [HttpGet("getHierarchy/{idCompany}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<List<CuentasContablesHierarchyDto>>> GetHierarchy(int idCompany)
        {
            try
            {
                var hierarchy = await _cuentasContablesService.GetHierarchy(idCompany);
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
        public async Task<ActionResult<List<CuentasContablesTreeDto>>> GetTree(int idCompany)
        {
            try
            {
                var tree = await _cuentasContablesService.GetTree(idCompany);
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
        public async Task<ActionResult<List<CuentasContablesHierarchyDto>>> GetHierarchyWithAmounts(
            int idCompany,
            [FromQuery] DateTime? fechaInicio,
            [FromQuery] DateTime? fechaFin)
        {
            try
            {
                var hierarchy = await _cuentasContablesService.GetHierarchyWithAmounts(idCompany, fechaInicio, fechaFin);
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
        /// Obtiene una cuenta contable por ID
        /// </summary>
        [HttpGet("getById/{id}")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CuentasContables>> GetById(int id)
        {
            try
            {
                var cuenta = await _cuentasContablesService.GetById(id);
                if (cuenta == null)
                {
                    _logger.LogWarning("CuentaContable with ID {Id} not found", id);
                    return NotFound(new { Message = "Cuenta not found", Id = id });
                }

                return Ok(cuenta);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving CuentaContable with ID {Id}", id);
                return StatusCode(500, "An error occurred while retrieving the cuenta.");
            }
        }

        /// <summary>
        /// Crea una nueva cuenta contable
        /// </summary>
        [HttpPost]
        [ProducesResponseType(StatusCodes.Status201Created)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<ActionResult<CuentasContables>> Create([FromBody] CuentasContables cuenta)
        {
            try
            {
                if (cuenta == null)
                {
                    return BadRequest(new { Message = "Invalid cuenta data" });
                }

                var createdCuenta = await _cuentasContablesService.Save(cuenta);

                return CreatedAtAction(
                    nameof(GetById),
                    new { id = createdCuenta.Id },
                    createdCuenta
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating CuentaContable");
                return StatusCode(500, "An error occurred while creating the cuenta.");
            }
        }

        /// <summary>
        /// Actualiza una cuenta contable existente
        /// </summary>
        [HttpPut("update/{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Update(int id, [FromBody] CuentasContables cuenta)
        {
            try
            {
                if (cuenta == null)
                {
                    return BadRequest(new { Message = "Invalid cuenta data" });
                }

                var success = await _cuentasContablesService.Update(id, cuenta);
                if (!success)
                {
                    return NotFound(new { Message = "Cuenta not found", Id = id });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating CuentaContable with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the cuenta.");
            }
        }

        /// <summary>
        /// Elimina (desactiva) una cuenta contable
        /// </summary>
        [HttpDelete("delete/{id}")]
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var success = await _cuentasContablesService.Delete(id);
                if (!success)
                {
                    return NotFound(new { Message = "Cuenta not found", Id = id });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting CuentaContable with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the cuenta.");
            }
        }
    }
}
