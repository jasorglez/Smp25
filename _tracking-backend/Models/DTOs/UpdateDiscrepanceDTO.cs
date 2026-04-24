namespace MicroServicioTracking.Models.DTOs;

public class UpdateDiscrepanceDTO
{
    public bool AllowDiscrepance { get; set; }
    public string? DiscrepanceAllowedApprovedBy { get; set; }
    public string Type { get; set; }
    public int? DiscrepanceAllowedReason { get; set; }
}