using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{

    public class PdfTextExtractionResult
    {
        public string FileName { get; set; }
        public string ExtractedText { get; set; }
        public int PageCount { get; set; }
        public List<PageInfo> Pages { get; set; } = new();
        public PdfMetadata Metadata { get; set; }
        public bool Success { get; set; }
        public string ErrorMessage { get; set; }
    }

    public class PageInfo
    {
        public int PageNumber { get; set; }
        public string Text { get; set; }
        public int WordCount { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
    }

    public class PdfMetadata
    {
        public string Title { get; set; }
        public string Author { get; set; }
        public string Subject { get; set; }
        public string Creator { get; set; }
        public string Producer { get; set; }
        public DateTime? CreationDate { get; set; }
        public DateTime? ModificationDate { get; set; }
    }

    public class TextSearchResult
    {
        public int PageNumber { get; set; }
        public string MatchedText { get; set; }
        public int Position { get; set; }
    }

    public class PdfUploadRequest
    {
        public byte[] PdfBytes { get; set; }
        public string FileName { get; set; }
    }
}