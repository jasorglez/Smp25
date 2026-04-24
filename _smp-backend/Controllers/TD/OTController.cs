using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMP.Services.TD;
using SMP.Models;
using SMP.Models.TD;
using SMP.Models.DTO;

namespace SMP.Controllers.TD
{

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class OTController : ControllerBase
    {
        private readonly ILogger<OTController> _logger;
        private readonly IOTService _otService;
        private readonly IWebHostEnvironment _env;


        public OTController(IOTService otService, ILogger<OTController> logger, IWebHostEnvironment env)
        {
            _otService = otService ?? throw new ArgumentNullException(nameof(otService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _env = env ?? throw new ArgumentNullException(nameof(env));
        }

        [HttpGet]
        public async Task<ActionResult<List<object>>> GetAll()
        {
            try
            {
                var ots = await _otService.GetAll();
                if (ots == null || ots.Count == 0)
                {
                    _logger.LogWarning("No OTs found or the result is empty");
                    return NotFound(new { Message = "No data found", OTs = new List<object>() });
                }
                return Ok(ots);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                return StatusCode(500, "An error occurred while retrieving OTs.");
            }
        }

        [HttpGet("2fields")]
        public async Task<ActionResult<List<object>>> Get2fields(int idProject)
        {
            try
            {
                var ots = await _otService.Get2fields(idProject);
                if (ots == null || ots.Count == 0)
                {
                    _logger.LogWarning("No OTs found or the result is empty");
                    return NotFound(new { Message = "No data found", OTs = new List<object>() });
                }
                return Ok(ots);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs");
                return StatusCode(500, "An error occurred while retrieving OTs.");
            }
        }

        [HttpGet("reports/{idCompany}")]
        public async Task<ActionResult<List<object>>> GetAllReports(int idCompany)
        {
            try
            {
                var rep = await _otService.GetOtReportsByCompany(idCompany);
                if (rep == null || rep.Count == 0)
                {
                    _logger.LogWarning("No Reportes Found or the result is empty");
                    return NotFound(new { Message = "No data found", OTs = new List<object>() });
                }
                return Ok(rep);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving Reports");
                return StatusCode(500, "An error occurred while retrieving Reports.");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<OT>> GetById(int id)
        {
            try
            {
                var ot = await _otService.GetById(id);
                if (ot == null || ot.Count == 0)
                {
                    _logger.LogWarning($"No OT found with id {id}");
                    return NotFound(new { Message = $"No OT found with id {id}" });
                }
                return Ok(ot);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OT by id");
                return StatusCode(500, "An error occurred while retrieving the OT.");
            }
        }

        [HttpGet("projects/{idProject}")]
        public async Task<ActionResult<List<OT>>> GetOtByProject(int idProject, [FromQuery] bool close)
        {
            try
            {
                var ots = await _otService.GetOtByProject(idProject, close);

                if (ots == null || ots.Count == 0)
                {
                    _logger.LogInformation("No OTs found for project ID {IdProject} with close={Close}", idProject, close);
                    return Ok(new List<OT>()); // Devolver lista vacía con 200 OK
                }

                return Ok(ots);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs for project ID {IdProject}", idProject);
                return StatusCode(500, "An error occurred while retrieving OTs for the project.");
            }
        }


        [HttpGet("project/{idProject}")]
        public async Task<ActionResult<List<OT>>> OtByProjectXapp(int idProject)
        {
            try
            {
                var ots = await _otService.OtByProjectforApp(idProject);

                if (ots == null || ots.Count == 0)
                {
                    _logger.LogInformation("No OTs found for project ID {IdProject} with close={Close}", idProject);
                    return Ok(new List<OT>()); // Devolver lista vacía con 200 OK
                }

                return Ok(ots);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving OTs for project ID {IdProject}", idProject);
                return StatusCode(500, "An error occurred while retrieving OTs for the project.");
            }
        }

        [HttpPost]
        public async Task<ActionResult> Save([FromBody] OT ot)
        {
            try
            {
                await _otService.Save(ot);
                return CreatedAtAction(nameof(GetById), new { id = ot.Id }, ot);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving OT");
                return StatusCode(500, "An error occurred while saving the OT.");
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult> UpdateOT(int id, [FromBody] OT updatedOT)
        {
            try
            {
                if (id <= 0)
                {
                    _logger.LogWarning("Invalid ID {Id} provided for update", id);
                    return BadRequest("Invalid ID provided");
                }

                var result = await _otService.UpdateOT(id, updatedOT);
                if (!result)
                {
                    _logger.LogWarning("OT with ID {Id} not found for update", id);
                    return NotFound(new { Message = $"OT with ID {id} not found or inactive" });
                }

                return Ok(new { Message = "OT updated successfully", Id = id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating OT with ID {Id}", id);
                return StatusCode(500, "An error occurred while updating the OT.");
            }
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult> DeleteOT(int id)
        {
            try
            {
                if (id <= 0)
                {
                    _logger.LogWarning("Invalid ID {Id} provided for delete", id);
                    return BadRequest("Invalid ID provided");
                }

                var result = await _otService.DeleteOT(id);
                if (!result)
                {
                    _logger.LogWarning("OT with ID {Id} not found for delete", id);
                    return NotFound(new { Message = $"OT with ID {id} not found or already inactive" });
                }

                return Ok(new { Message = "OT deleted successfully", Id = id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting OT with ID {Id}", id);
                return StatusCode(500, "An error occurred while deleting the OT.");
            }
        }

        [HttpPut("{id}/reopen")]
        public async Task<ActionResult> ReopenOT(int id)
        {
            try
            {
                if (id <= 0)
                {
                    _logger.LogWarning("Invalid ID {Id} provided for reopen", id);
                    return BadRequest("Invalid ID provided");
                }

                var result = await _otService.Reopen(id);
                if (!result)
                {
                    _logger.LogWarning("OT with ID {Id} not found for reopen", id);
                    return NotFound(new { Message = $"OT with ID {id} not found or inactive" });
                }

                return Ok(new { Message = "OT reopened successfully", Id = id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening OT with ID {Id}", id);
                return StatusCode(500, "An error occurred while reopening the OT.");
            }
        }

        // NUEVO ENDPOINT PARA ACTUALIZAR PROYECTO DE UNA OT
        [HttpPut("ots/{idOt}/project/{newIdProject}")]
        public async Task<IActionResult> UpdateProjectForOt(int idOt, int newIdProject, [FromQuery] int? oldIdProject = null)
        {
            try
            {
                if (idOt <= 0 || newIdProject <= 0)
                {
                    _logger.LogWarning("IDs inválidos proporcionados: idOt={IdOt}, newIdProject={NewIdProject}", idOt, newIdProject);
                    return BadRequest(new { success = false, message = "IDs inválidos proporcionados" });
                }

                _logger.LogInformation("UpdateProjectForOt - idOt: {IdOt}, newIdProject: {NewIdProject}, oldIdProject: {OldIdProject}", idOt, newIdProject, oldIdProject);

                var result = await _otService.UpdateProjectForOt(idOt, newIdProject, oldIdProject);

                // Usar reflexión para verificar si la operación fue exitosa
                var successProperty = result?.GetType()?.GetProperty("success")?.GetValue(result);
                var success = successProperty is bool boolValue && boolValue;

                if (!success)
                {
                    _logger.LogWarning("No se pudo actualizar el proyecto para OT ID: {IdOt}", idOt);
                    return BadRequest(result);
                }

                _logger.LogInformation("Proyecto actualizado exitosamente para OT ID: {IdOt}", idOt);
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar proyecto para OT ID: {IdOt}", idOt);
                return StatusCode(500, new 
                { 
                    success = false, 
                    message = "Error interno del servidor al actualizar el proyecto",
                    updatedCount = 0
                });
            }
        }

        [HttpPost("RegistrarOT")]
        public async Task<ActionResult<RegistrarOTResponse>> RegistrarOT([FromBody] RegistrarOTRequest request)
        {
            try
            {
                // Log del JSON recibido desde Android
                var requestJson = System.Text.Json.JsonSerializer.Serialize(request);
                _logger.LogInformation("JSON recibido desde Android: {RequestJson}", requestJson);

                if (!ModelState.IsValid)
                {
                    _logger.LogWarning("Invalid model state for RegistrarOT request");
                    return BadRequest(ModelState);
                }

                var response = await _otService.RegistrarOT(request);

                if (!response.Success)
                {
                    _logger.LogWarning("Failed to register OT: {Message}", response.Message);
                    return BadRequest(response);
                }

                _logger.LogInformation("OT registered successfully with ID: {RegistroId}", response.RegistroId);
                return CreatedAtAction(nameof(GetById), new { id = response.RegistroId }, response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error registering OT for ID: {Id}", request?.Id);
                return StatusCode(500, new RegistrarOTResponse
                {
                    Success = false,
                    Message = "An error occurred while registering the OT."
                });
            }
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadPdf(IFormFile file,int pageNumber , int? idProject = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Archivo vacío");

            var filePath = Path.Combine(_env.ContentRootPath, "Uploads", file.FileName);
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            _logger.LogInformation("..........................Archivo PDF guardado en: {FilePath}", filePath);

            var ordenes = await _otService.PDFProcess(filePath, pageNumber, idProject);

            if (ordenes == null)
            {
                return StatusCode(500, new { message = "No se pudo procesar ninguna OT desde el PDF." });
            }

            return Ok(new
            {
                message = "PDF procesado y datos guardados",
                otId = ordenes.Id,
                otNumber = ordenes.OtNumber
            });


            //var ordenes = _parser.Procesar(filePath);

            /*   _context.OrdenesTrabajo.AddRange(ordenes);
               await _context.SaveChangesAsync();*/

            //            return Ok(new { message = "PDF procesado y datos guardados", cantidad = ordenes.Count });
        }

        [HttpPost("uploadCopy")]
        public async Task<IActionResult> UploadPdfCopy(IFormFile file,int pageNumber, int? idProject = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Archivo vacío");

            var filePath = Path.Combine(_env.ContentRootPath, "Uploads", file.FileName);
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            _logger.LogInformation("..........................Archivo PDF guardado en: {FilePath}", filePath);

            var ordenes = await _otService.PDFProcessCopy(filePath,pageNumber, idProject);

            if (ordenes == null)
            {
                return StatusCode(500, new { message = "No se pudo procesar ninguna OT desde el PDF." });
            }

            return Ok(new
            {
                message = "PDF procesado y datos guardados",
                otId = ordenes.Id,
                otNumber = ordenes.OtNumber
            });


            //var ordenes = _parser.Procesar(filePath);

            /*   _context.OrdenesTrabajo.AddRange(ordenes);
               await _context.SaveChangesAsync();*/

            //            return Ok(new { message = "PDF procesado y datos guardados", cantidad = ordenes.Count });
        }
        
        [HttpPost("uploadMaster")]
        public async Task<IActionResult> UploadPdfMaster(IFormFile file, int? idProject = null)
        {
            if (file == null || file.Length == 0) return BadRequest("Archivo vacío");

            var filePath = Path.Combine(_env.ContentRootPath, "Uploads", file.FileName);
            Directory.CreateDirectory(Path.GetDirectoryName(filePath)!);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            _logger.LogInformation("..........................Archivo PDF guardado en: {FilePath}", filePath);

            var result = await _otService.PDFProcessMaster(filePath, idProject);

            if (result.TotalPages == 0)
            {
                return BadRequest("El PDF está vacío o no se pudo leer.");
            }

            var message = $"{result.SkippedCount} OT(s) ya se encontraban en el sistema o no fueron procesadas y {result.CreatedCount} OT(s) fueron guardadas.";

            if (result.CreatedCount == 0 && result.SkippedCount > 0)
            {
                message = $"No se guardaron nuevas OTs. {result.SkippedCount} OT(s) ya se encontraban en el sistema o no pudieron ser procesadas.";
            }
            else if (result.CreatedCount > 0 && result.SkippedCount == 0)
            {
                message = $"Todas las {result.CreatedCount} OT(s) fueron guardadas exitosamente.";
            }
            
            if (result.CreatedCount == 0 && result.SkippedCount == result.TotalPages)
            {
                 return StatusCode(409, new { message, result.CreatedCount, result.SkippedCount });
            }


            return Ok(new { message, result.CreatedCount, result.SkippedCount });
        }
    }
    
}