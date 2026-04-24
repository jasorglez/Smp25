using Microsoft.AspNetCore.Mvc;
using SMP.Models;
using SMP.Services;
using SMP.Services.TD;

namespace SMP.Controllers.TD
{
    [ApiController]
    [Route("api/[controller]")]
    public class PdfController : ControllerBase
    {
        private readonly IPdfProcessingService _pdfProcessingService;
        private readonly ILogger<PdfController> _logger;

        public PdfController(IPdfProcessingService pdfProcessingService, ILogger<PdfController> logger)
        {
            _pdfProcessingService = pdfProcessingService;
            _logger = logger;
        }

        [HttpPost("extract-text")]
        public async Task<ActionResult<PdfTextExtractionResult>> ExtractTextFromPdf(IFormFile pdfFile)
        {
            if (pdfFile == null || pdfFile.Length == 0)
            {
                return BadRequest("No se proporcionó ningún archivo PDF.");
            }

            if (!pdfFile.ContentType.Equals("application/pdf", StringComparison.OrdinalIgnoreCase))
            {
                return BadRequest("El archivo debe ser un PDF válido.");
            }

            try
            {
                using var stream = pdfFile.OpenReadStream();
                var result = await _pdfProcessingService.ExtractTextFromPdfAsync(stream, pdfFile.FileName);

                if (!result.Success)
                {
                    return BadRequest($"Error al procesar el PDF: {result.ErrorMessage}");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unexpected al procesar PDF");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpPost("extract-text-from-bytes")]
        public async Task<ActionResult<PdfTextExtractionResult>> ExtractTextFromPdfBytes([FromBody] PdfUploadRequest request)
        {
            if (request?.PdfBytes == null || request.PdfBytes.Length == 0)
            {
                return BadRequest("No se proporcionaron datos del PDF.");
            }

            try
            {
                var result = await _pdfProcessingService.ExtractTextFromPdfAsync(request.PdfBytes, request.FileName ?? "documento.pdf");

                if (!result.Success)
                {
                    return BadRequest($"Error al procesar el PDF: {result.ErrorMessage}");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error unexpected al procesar PDF desde bytes");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpPost("search/{searchTerm}")]
        public async Task<ActionResult<List<TextSearchResult>>> SearchInPdf(string searchTerm, IFormFile pdfFile)
        {
            if (string.IsNullOrWhiteSpace(searchTerm))
            {
                return BadRequest("El término de búsqueda no puede estar vacío.");
            }

            if (pdfFile == null || pdfFile.Length == 0)
            {
                return BadRequest("No se proporcionó ningún archivo PDF.");
            }

            try
            {
                using var stream = pdfFile.OpenReadStream();
                var results = await _pdfProcessingService.SearchTextInPdfAsync(stream, searchTerm);
                return Ok(results);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching in PDF");
                return StatusCode(500, "Error interno del servidor");
            }
        }

        [HttpPost("metadata")]
        public async Task<ActionResult<PdfMetadata>> ExtractMetadata(IFormFile pdfFile)
        {
            if (pdfFile == null || pdfFile.Length == 0)
            {
                return BadRequest("No se proporcionó ningún archivo PDF.");
            }

            try
            {
                using var stream = pdfFile.OpenReadStream();
                var metadata = await _pdfProcessingService.ExtractMetadataFromPdfAsync(stream);
                return Ok(metadata);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting metadata from PDF");
                return StatusCode(500, "Error interno del servidor");
            }
        }
    }

    public class PdfUploadRequest
    {
        public byte[] PdfBytes { get; set; }
        public string FileName { get; set; }
    }
}