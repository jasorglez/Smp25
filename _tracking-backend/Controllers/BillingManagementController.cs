using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MicroServicioTracking.Services;
using MicroServicioTracking.Models;
using MicroServicioTracking.Services.Fact;
using MicroServicioTracking.Models.Fact;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class BillingManagementController : ControllerBase
{
    private readonly IBillingManagementService _billingService;
    private readonly IInvoiceXmlService _invoiceXmlService;
    private readonly ICfdiCancellationService _cancellationService;
    private readonly ISatValidationService _satValidationService;
    private readonly IInvoicePdfService _invoicePdfService;
    private readonly DbTrackingContext _context;
    private readonly ILogger<BillingManagementController> _logger;

    public BillingManagementController(
        IBillingManagementService billingService,
        IInvoiceXmlService invoiceXmlService,
        ICfdiCancellationService cancellationService,
        ISatValidationService satValidationService,
        IInvoicePdfService invoicePdfService,
        DbTrackingContext context,
        ILogger<BillingManagementController> logger)
    {
        _billingService = billingService;
        _invoiceXmlService = invoiceXmlService;
        _cancellationService = cancellationService;
        _satValidationService = satValidationService;
        _invoicePdfService = invoicePdfService;
        _context = context;
        _logger = logger;
    }

    [HttpGet("config/{idRoot}")]
    public async Task<IActionResult> GetConfig(int idRoot)
    {
        try
        {
            var config = await _billingService.ConfigByRoot(idRoot);
            return Ok(config);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting billing config for root {IdRoot}", idRoot);
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("save")]
    public async Task<IActionResult> Save([FromBody] BillingManagement billingManagement)
    {
        try
        {
            await _billingService.Save(billingManagement);
            return Ok(new { success = true, message = "Billing configuration saved" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving billing config");
            return BadRequest(new { success = false, error = ex.Message });
        }
    }

    [HttpPut("update/{idRoot}")]
    public async Task<IActionResult> Update(int idRoot, [FromBody] BillingManagement billingManagement)
    {
        try
        {
            var updated = await _billingService.Update(idRoot, billingManagement);
            if (updated == null)
                return NotFound(new { success = false, error = "Billing configuration not found" });

            return Ok(new { success = true, data = updated });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating billing config");
            return BadRequest(new { success = false, error = ex.Message });
        }
    }

    /// <summary>
    /// Genera el XML de la factura SIN timbrar (para previsualizaci�n)
    /// </summary>
    [HttpPost("generate-xml/{idIncomeExpense}")]
    public async Task<IActionResult> GenerateXml(int idIncomeExpense)
    {
        try
        {
            var xml = await _invoiceXmlService.GenerateInvoiceXml(idIncomeExpense);
            return Ok(new { xml, success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating XML for income/expense {Id}", idIncomeExpense);
            return BadRequest(new { error = ex.Message, success = false });
        }
    }

    /// <summary>
    /// Genera el XML, firma y timbra con FINKOK en un solo paso
    /// </summary>
    [HttpPost("stamp/{idIncomeExpense}")]
    public async Task<IActionResult> StampInvoice(int idIncomeExpense)
    {
        try
        {
            _logger.LogInformation("Starting stamp process for income/expense ID: {Id}", idIncomeExpense);

            var result = await _billingService.GenerateAndStampInvoice(idIncomeExpense);

            _logger.LogInformation("Invoice stamped successfully. UUID: {UUID}", result.Uuid);

            return Ok(new
            {
                success = true,
                uuid = result.Uuid,
                stampedXml = result.StampedXml,
                fechaTimbrado = result.FechaTimbrado,
                noCertificadoSat = result.NoCertificadoSat,
                message = "Factura timbrada exitosamente"
            });
        }
        catch (FinkokStampException fex)
        {
            _logger.LogError(fex, "Finkok stamping error for income/expense {Id}. Code: {Code}",
                idIncomeExpense, fex.FinkokError?.Code);

            return BadRequest(new
            {
                success = false,
                error = fex.Message,
                errorCode = fex.FinkokError?.Code,
                errorDetail = fex.FinkokError?.DetailedMessage,
                incidenceId = fex.FinkokError?.IncidenceId,
                errorType = "finkok_error"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error stamping invoice for income/expense {Id}", idIncomeExpense);

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                errorType = "system_error",
                detail = "Error interno del sistema. Contacta a soporte técnico."
            });
        }
    }

    /// <summary>
    /// Sube los archivos de certificados (.cer y .key) y los guarda en la base de datos
    /// </summary>
    [HttpPost("upload-certificates/{idRoot}")]
    public async Task<IActionResult> UploadCertificates(int idRoot, [FromForm] UploadCertificatesRequest request)
    {
        try
        {
            if (request.CerFile == null && request.KeyFile == null)
            {
                return BadRequest(new { message = "At least one certificate file must be provided" });
            }

            var config = await _billingService.ConfigByRoot(idRoot);
            if (config == null || !config.Any())
            {
                return NotFound(new { message = "Billing configuration not found for the specified root" });
            }

            var billing = config.First();

            // Procesar archivo .cer
            if (request.CerFile != null && request.CerFile.Length > 0)
            {
                var cerExtension = Path.GetExtension(request.CerFile.FileName).ToLowerInvariant();
                if (cerExtension != ".cer")
                {
                    return BadRequest(new { message = "Certificate file must have .cer extension" });
                }

                if (request.CerFile.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { message = "Certificate file size must not exceed 5MB" });
                }

                using var memoryStream = new MemoryStream();
                await request.CerFile.CopyToAsync(memoryStream);
                billing.CerFileContent = memoryStream.ToArray();

                _logger.LogInformation("Certificate uploaded for idRoot {IdRoot}: {FileName}, Size: {Size} bytes",
                    idRoot, request.CerFile.FileName, billing.CerFileContent.Length);
            }

            // Procesar archivo .key
            if (request.KeyFile != null && request.KeyFile.Length > 0)
            {
                var keyExtension = Path.GetExtension(request.KeyFile.FileName).ToLowerInvariant();
                if (keyExtension != ".key")
                {
                    return BadRequest(new { message = "Key file must have .key extension" });
                }

                if (request.KeyFile.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { message = "Key file size must not exceed 5MB" });
                }

                using var memoryStream = new MemoryStream();
                await request.KeyFile.CopyToAsync(memoryStream);
                billing.KeyFileContent = memoryStream.ToArray();

                _logger.LogInformation("Key file uploaded for idRoot {IdRoot}: {FileName}, Size: {Size} bytes",
                    idRoot, request.KeyFile.FileName, billing.KeyFileContent.Length);
            }

            await _billingService.Update(idRoot, billing);

            return Ok(new
            {
                message = "Certificates uploaded and saved to database successfully",
                cerUploaded = request.CerFile != null,
                keyUploaded = request.KeyFile != null,
                cerSize = billing.CerFileContent?.Length ?? 0,
                keySize = billing.KeyFileContent?.Length ?? 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading certificates for root {IdRoot}", idRoot);
            return StatusCode(500, new { message = "An error occurred while uploading certificates" });
        }
    }

    /// <summary>
    /// Cancela un CFDI timbrado
    /// </summary>
    [HttpPost("cancel/{idIncomeExpense}")]
    public async Task<IActionResult> CancelCfdi(int idIncomeExpense, [FromBody] CancellationRequest request)
    {
        try
        {
            _logger.LogInformation("Starting CFDI cancellation for income/expense ID: {Id}", idIncomeExpense);

            var result = await _cancellationService.CancelCfdi(idIncomeExpense, request);

            if (result.Success)
            {
                _logger.LogInformation("CFDI cancelled successfully. UUID: {UUID}", result.Uuid);

                return Ok(new
                {
                    success = true,
                    uuid = result.Uuid,
                    estatusCancelacion = result.EstatusCancelacion,
                    message = result.Message,
                    acuseRecibo = result.AcuseRecibo
                });
            }
            else
            {
                _logger.LogWarning("CFDI cancellation failed. UUID: {UUID}, Error: {Error}",
                    result.Uuid, result.ErrorMessage);

                return BadRequest(new
                {
                    success = false,
                    uuid = result.Uuid,
                    error = result.ErrorMessage,
                    errorCode = result.ErrorCode
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling CFDI for income/expense {Id}", idIncomeExpense);

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message,
                errorType = "system_error"
            });
        }
    }

    /// <summary>
    /// Valida un CFDI directamente con el SAT
    /// </summary>
    [HttpPost("validate-sat/{idIncomeExpense}")]
    public async Task<IActionResult> ValidateWithSat(int idIncomeExpense)
    {
        try
        {
            _logger.LogInformation("Starting SAT validation for income/expense ID: {Id}", idIncomeExpense);

            // Obtener datos de la factura
            var incomeData = await _context.Incomeandexpenses
                .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

            if (incomeData == null)
                return NotFound(new { success = false, error = "Factura no encontrada" });

            if (string.IsNullOrEmpty(incomeData.Uuid))
                return BadRequest(new { success = false, error = "La factura no tiene UUID. No ha sido timbrada." });

            // Obtener configuración de facturación
            var billingConfig = await _context.BillingManagement
                .FirstOrDefaultAsync(b => b.Id == incomeData.IdBillingConfig && b.Active);

            if (billingConfig == null)
                return NotFound(new { success = false, error = "Configuración de facturación no encontrada" });

            // Obtener RFC del receptor desde CustomersBilling
            var customerBilling = await _context.CustomersBillings
                .FirstOrDefaultAsync(cb => cb.Id == incomeData.IdCustomerBilling && cb.Active);

            var request = new SatValidationRequest
            {
                Uuid = incomeData.Uuid,
                RfcEmisor = billingConfig.EmisorRfc ?? "",
                RfcReceptor = customerBilling?.Rfc ?? "",
                Total = incomeData.Total
            };

            var result = await _satValidationService.ValidateCfdiWithSat(request);

            _logger.LogInformation("SAT validation completed. UUID: {UUID}, Valid: {Valid}",
                request.Uuid, result.IsValid);

            return Ok(new
            {
                success = true,
                isValid = result.IsValid,
                codigoEstatus = result.CodigoEstatus,
                estado = result.Estado,
                esCancelable = result.EsCancelable,
                estatusCancelacion = result.EstatusCancelacion,
                message = result.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating CFDI with SAT for income/expense {Id}", idIncomeExpense);

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Genera el PDF de una factura timbrada
    /// </summary>
    [HttpGet("pdf/{idIncomeExpense}")]
    public async Task<IActionResult> GeneratePdf(int idIncomeExpense)
    {
        try
        {
            _logger.LogInformation("Starting PDF generation for income/expense ID: {Id}", idIncomeExpense);

            var pdfBytes = await _invoicePdfService.GenerateInvoicePdf(idIncomeExpense);

            _logger.LogInformation("PDF generated successfully. Size: {Size} bytes", pdfBytes.Length);

            // Obtener datos para el nombre del archivo
            var income = await _context.Incomeandexpenses
                .FirstOrDefaultAsync(i => i.Id == idIncomeExpense && i.Active);

            var fileName = $"Factura_{income?.Serie}_{income?.Folio}_{income?.Uuid?.Substring(0, 8)}.html";

            // NOTA: Por ahora se retorna HTML. Para producción, cambiar a application/pdf
            return File(pdfBytes, "text/html", fileName);

            // Cuando implementes PDF real:
            // return File(pdfBytes, "application/pdf", fileName.Replace(".html", ".pdf"));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PDF for income/expense {Id}", idIncomeExpense);

            return StatusCode(500, new
            {
                success = false,
                error = ex.Message
            });
        }
    }

    /// <summary>
    /// Actualiza los archivos de certificados (.cer y .key) cuando el usuario se equivoca
    /// </summary>
    [HttpPut("update-certificates/{idRoot}")]
    public async Task<IActionResult> UpdateCertificates(int idRoot, [FromForm] UploadCertificatesRequest request)
    {
        try
        {
            _logger.LogInformation("Updating certificates for idRoot: {IdRoot}", idRoot);

            byte[]? cerFileContent = null;
            byte[]? keyFileContent = null;

            // Procesar archivo .cer si se proporciona
            if (request.CerFile != null && request.CerFile.Length > 0)
            {
                var cerExtension = Path.GetExtension(request.CerFile.FileName).ToLowerInvariant();
                if (cerExtension != ".cer")
                {
                    return BadRequest(new { message = "Certificate file must have .cer extension" });
                }

                if (request.CerFile.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { message = "Certificate file size must not exceed 5MB" });
                }

                using var memoryStream = new MemoryStream();
                await request.CerFile.CopyToAsync(memoryStream);
                cerFileContent = memoryStream.ToArray();

                _logger.LogInformation("Processing certificate file: {FileName}, Size: {Size} bytes",
                    request.CerFile.FileName, cerFileContent.Length);
            }

            // Procesar archivo .key si se proporciona
            if (request.KeyFile != null && request.KeyFile.Length > 0)
            {
                var keyExtension = Path.GetExtension(request.KeyFile.FileName).ToLowerInvariant();
                if (keyExtension != ".key")
                {
                    return BadRequest(new { message = "Key file must have .key extension" });
                }

                if (request.KeyFile.Length > 5 * 1024 * 1024)
                {
                    return BadRequest(new { message = "Key file size must not exceed 5MB" });
                }

                using var memoryStream = new MemoryStream();
                await request.KeyFile.CopyToAsync(memoryStream);
                keyFileContent = memoryStream.ToArray();

                _logger.LogInformation("Processing key file: {FileName}, Size: {Size} bytes",
                    request.KeyFile.FileName, keyFileContent.Length);
            }

            // Validar que se proporcione al menos un archivo
            if (cerFileContent == null && keyFileContent == null)
            {
                return BadRequest(new { message = "At least one certificate file must be provided for update" });
            }

            var updated = await _billingService.UpdateCertificates(idRoot, cerFileContent, keyFileContent);

            if (updated == null)
                return NotFound(new { success = false, error = "Billing configuration not found" });

            return Ok(new
            {
                success = true,
                message = "Certificates updated successfully",
                cerUpdated = request.CerFile != null,
                keyUpdated = request.KeyFile != null,
                cerSize = cerFileContent?.Length ?? 0,
                keySize = keyFileContent?.Length ?? 0
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating certificates for root {IdRoot}", idRoot);
            return StatusCode(500, new
            {
                success = false,
                message = "An error occurred while updating certificates",
                error = ex.Message
            });
        }

    }

    /// <summary>
    /// Verifica el estado de los certificados
    /// </summary>
    [HttpGet("check-certificates/{idRoot}")]
    public async Task<IActionResult> CheckCertificates(int idRoot)
    {
        try
        {
            var config = await _billingService.ConfigByRoot(idRoot);
            if (config == null || !config.Any())
            {
                return Ok(new
                {
                    certificateConfigured = false,
                    keyConfigured = false,
                    isFullyConfigured = false
                });
            }

            var billing = config.First();

            var certificateConfigured = billing.CerFileContent != null && billing.CerFileContent.Length > 0;
            var keyConfigured = billing.KeyFileContent != null && billing.KeyFileContent.Length > 0;
            var isFullyConfigured = certificateConfigured && keyConfigured;

            return Ok(new
            {
                certificateConfigured,
                keyConfigured,
                isFullyConfigured
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking certificates for root {IdRoot}", idRoot);
            return StatusCode(500, new { message = "Error al verificar certificados" });
        }
    }


        [HttpPut("{idRoot}/consecutive")]
        public async Task<ActionResult<BillingManagement>> UpdateConsecutive(
            int idRoot,
            [FromBody] UpdateConsecutiveRequest request)
        {
            try
            {
                if (request.Consecutive < 0)
                {
                    return BadRequest("El consecutivo no puede ser un valor negativo");
                }

                var updatedBilling = await _billingService.UpdateConsecutiveAsync(idRoot, request.Consecutive);

                if (updatedBilling == null)
                {
                    return NotFound($"No se encontró la configuración de facturación activa para el root ID {idRoot}");
                }

                return Ok(updatedBilling);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error actualizando consecutivo para root ID {IdRoot}", idRoot);
                return StatusCode(500, "Error interno del servidor al actualizar el consecutivo");
            }
        }
    
}