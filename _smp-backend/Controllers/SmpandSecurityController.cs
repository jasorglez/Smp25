using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SMP.Services;
using System.Linq.Expressions;

namespace SMP.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class SmpandSecurityController : ControllerBase
    {

        private readonly ISmpandSecurity _smpandSecurityService;
        private readonly ILogger<SmpandSecurityController> _logger;

        public SmpandSecurityController(ISmpandSecurity smpandSecurity, ILogger<SmpandSecurityController> logger)
        {
            _smpandSecurityService = smpandSecurity ?? throw new ArgumentNullException(nameof(smpandSecurity)); ;
            _logger                = logger ?? throw new ArgumentNullException(nameof(logger));
        }

       [HttpGet("root")]
        public async Task<IActionResult> Root(int idUser)
        {
            try                
            {                
                var comb = await _smpandSecurityService.GetCombinedDataRoot(idUser);
                if (comb == null || !comb.Any())
                {
                    _logger.LogWarning("No Root found or the result is empty");
                    return NotFound(new { Message = "No Root Found or the result is empty", smpandsecurity = new List<object>() });
                }
                return Ok(comb);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Root for Project");
                return StatusCode(500, "An error occurred while retrieving Root.");
            }
        }

        [HttpGet("contract")]
        public async Task<IActionResult> Contract(int idUser, int idBussines)
        {
            try
            {                
                var comb = await _smpandSecurityService.GetCombinedDataContract(idUser, idBussines);
                if (comb == null || !comb.Any())
                {
                    _logger.LogWarning("No Contract found or the result is empty");
                    return NotFound(new { Message = "No Contract Found the result is empty", contract = new List<object>() });
                }
                return Ok(new { contract = comb });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving contract for idUser: {IdUser} and idBussines: {IdBussines}", idUser, idBussines);
                return StatusCode(500, new { Message = "An error occurred while retrievin Contracts.", Error = ex.Message });
            }
        }


        [HttpGet("project")]
        public async Task<IActionResult> Project(int idUser, int idContract)
        {
            try
            {
                var comb = await _smpandSecurityService.GetCombinedDataProject( idUser, idContract);
                if (comb == null || !comb.Any())
                {
                    _logger.LogWarning("No Project found or the result is empty");
                    return NotFound(new { Message = "No Project found", project = new List<object>() });
                }
                return Ok(new { project = comb });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving projects for idUser: {IdUser} and idContract: {IdContract}", idUser, idContract);
                return StatusCode(500, new { Message = "An error occurred while retrieving projects.", Error = ex.Message });
            }
        }

        [HttpGet("Branch")]
        public async Task<IActionResult> Branch(int idUser, int idRoot)
        {
            try
            {
                var comb = await _smpandSecurityService.GetCombinedDataBranch(idUser, idRoot);
                if (comb == null || !comb.Any())
                {
                    _logger.LogWarning("No Branch found or the result is empty");
                    return NotFound(new { Message = "No Branch found", branch = new List<object>() });
                }
                return Ok(new { project = comb });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving projects for idUser: {IdUser} and idContract: {IdContract}", idUser, idRoot);
                return StatusCode(500, new { Message = "An error occurred while retrieving projects.", Error = ex.Message });
            }
        }


    }
}

