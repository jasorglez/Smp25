namespace MicroServicioTracking.Models.DTOs
{
    public class AuthorizationCallbackDto
    {
        public int DocumentId { get; set; }
        public string Folio { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty; // APPROVED or REJECTED
        public int IdAuthorize { get; set; }
        public string? AuthorizeName { get; set; }
        public string? RejectionReason { get; set; }
        public DateTime RespondedAt { get; set; }
    }
}
