using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View;

[Table("vw_employee_time_discrepancies")]
public class EmployeesxDiscrepancesChecksView
{
    [Column("id")]
    public int Id { get; set; }

    [Column("id_employee")]
    public int IdEmployee { get; set; }

    [Column("name")]
    public string Name { get; set; }

    [Column("id_branch")]
    public int IdBranch { get; set; }

    [Column("date_stamp")]
    public DateOnly DateStamp { get; set; }

    [Column("time_stamp_only")]
    public TimeOnly TimeStampOnly { get; set; }

    [Column("real_time_only")]
    public TimeOnly? RealTimeOnly { get; set; }

    [Column("time_discrepance")]
    public int? TimeDiscrepance { get; set; }

    [Column("allow_discrepance")]
    public bool? AllowDiscrepance { get; set; }

    [Column("discrepance_allowed_reason")]
    public int? DiscrepanceAllowedReason { get; set; }

    [Column("discrepance_allowed_approved_by")]
    public string? DiscrepanceAllowedApprovedBy { get; set; }

    [Column("type")]
    public string Type { get; set; }
}