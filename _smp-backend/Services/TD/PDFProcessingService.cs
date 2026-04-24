using UglyToad.PdfPig;
using UglyToad.PdfPig.Content;
using System.Text;
using SMP.Models;
using System.Text.RegularExpressions;

namespace SMP.Services.TD
{

    public interface IPdfProcessingService
    {
        Task<PdfTextExtractionResult> ExtractTextFromPdfAsync(Stream pdfStream, string fileName);
        Task<PdfTextExtractionResult> ExtractTextFromPdfAsync(byte[] pdfBytes, string fileName);
        Task<List<TextSearchResult>> SearchTextInPdfAsync(Stream pdfStream, string searchTerm);
        Task<PdfMetadata> ExtractMetadataFromPdfAsync(Stream pdfStream);
    }

    public class PdfProcessingService : IPdfProcessingService
    {
        private readonly ILogger<PdfProcessingService> _logger;

        public PdfProcessingService(ILogger<PdfProcessingService> logger)
        {
            _logger = logger;
        }

        public async Task<PdfTextExtractionResult> ExtractTextFromPdfAsync(Stream pdfStream, string fileName)
        {
            try
            {
                var result = new PdfTextExtractionResult
                {
                    FileName = fileName,
                    Success = true
                };

                using var document = PdfDocument.Open(pdfStream);

                result.PageCount = document.NumberOfPages;
                result.Metadata = ExtractMetadata(document);
                var allText = new StringBuilder();

                foreach (var page in document.GetPages())
                {
                    var pageText = page.Text;
                    var pageInfo = new PageInfo
                    {
                        PageNumber = page.Number,
                        Text = pageText,
                        WordCount = pageText.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length,
                        Width = (double)page.Width,
                        Height = (double)page.Height
                    };

                    result.Pages.Add(pageInfo);
                    allText.AppendLine(pageText);
                }

                result.ExtractedText = allText.ToString();

                _logger.LogInformation("Successfully processed PDF: {FileName}, Pages: {PageCount}",
                    fileName, result.PageCount);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing PDF: {FileName}", fileName);

                return new PdfTextExtractionResult
                {
                    FileName = fileName,
                    Success = false,
                    ErrorMessage = ex.Message
                };
            }
        }

        public async Task<PdfTextExtractionResult> ExtractTextFromPdfAsync(byte[] pdfBytes, string fileName)
        {
            using var stream = new MemoryStream(pdfBytes);
            return await ExtractTextFromPdfAsync(stream, fileName);
        }

        public async Task<List<TextSearchResult>> SearchTextInPdfAsync(Stream pdfStream, string searchTerm)
        {
            try
            {
                using var document = PdfDocument.Open(pdfStream);
                return SearchTextInPdf(document, searchTerm);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error searching text in PDF");
                return new List<TextSearchResult>();
            }
        }

        public async Task<PdfMetadata> ExtractMetadataFromPdfAsync(Stream pdfStream)
        {
            try
            {
                using var document = PdfDocument.Open(pdfStream);
                return ExtractMetadata(document);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting metadata from PDF");
                return new PdfMetadata();
            }
        }

        #region Private Methods

        private PdfMetadata ExtractMetadata(PdfDocument document)
        {
            var info = document.Information;

            return new PdfMetadata
            {
                Title = info.Title ?? string.Empty,
                Author = info.Author ?? string.Empty,
                Subject = info.Subject ?? string.Empty,
                Creator = info.Creator ?? string.Empty,
                Producer = info.Producer ?? string.Empty,
                CreationDate = DateTime.TryParse(info.CreationDate, out DateTime creationDate) ? creationDate : null,
                ModificationDate = DateTime.TryParse(info.ModifiedDate, out DateTime modificationDate) ? modificationDate : null
            };
        }

        private List<TextSearchResult> SearchTextInPdf(PdfDocument document, string searchTerm)
        {
            var results = new List<TextSearchResult>();

            foreach (var page in document.GetPages())
            {
                var pageText = page.Text;
                var index = pageText.IndexOf(searchTerm, StringComparison.OrdinalIgnoreCase);

                while (index != -1)
                {
                    results.Add(new TextSearchResult
                    {
                        PageNumber = page.Number,
                        MatchedText = searchTerm,
                        Position = index
                    });

                    index = pageText.IndexOf(searchTerm, index + 1, StringComparison.OrdinalIgnoreCase);
                }
            }

            return results;
        }
        
        private string ExtractBetween(string input, string start, string end)
        {
            if (string.IsNullOrEmpty(input) || string.IsNullOrEmpty(start) || string.IsNullOrEmpty(end))
            return string.Empty;

            // Escapar los delimitadores por si contienen caracteres especiales
            string inicioEscapado = Regex.Escape(start);
            string finEscapado = Regex.Escape(end);

            // Crear el patrón usando los delimitadores
            string patron = $"{inicioEscapado}\\s*(.*?)\\s*{finEscapado}";

            Match match = Regex.Match(input, patron, RegexOptions.Singleline);
            return match.Success ? match.Groups[1].Value.Trim() : string.Empty;
        }

        #endregion
    }
}