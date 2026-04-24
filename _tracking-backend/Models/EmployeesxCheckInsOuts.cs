using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("employeesxcheckinsouts")]
public class EmployeesxCheckInsOuts
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_employee")]
    public int IdEmployee { get; set; }
    
    [Column("time_stamp")]
    public DateTime TimeStamp { get; set; }
    
    [Column("time_stamp_backup")]
    public DateTime? TimeStampBackup { get; set; }

    [Column("idBlockPeriod")]
    public int? IdBlockPeriod { get; set; }

    [Column("type")]
    public string Type { get; set; }
    
    [Column("valid")]
    public bool Valid { get; set; }

    [Column("minuteDiscount")]
    public decimal? MinuteDiscount { get; set; } = 0;
    
    [Column("minuteDiscountBackup")]
    public decimal? MinuteDiscountBackup { get; set; }

    [Column("by_time_clock")]
    public bool ByTimeClock { get; set; } = true;

    [Column("edited")]
    public bool? Edited { get; set; } = false;
    
    [Column("edited_by")]
    public String? EditedBy { get; set; }
    
    [Column("id_reason")]
    public int? IdReason { get; set; }
    
    [Column("holiday")]
    public bool? Holiday { get; set; }
    
    [Column("comments")]
    public string? Comments { get; set; }
    
    [Column("real_time_by_system")]
    public DateTime? RealTimeBySystem { get; set; }

    [Column("adjustedTimeBySystem")]
    public DateTime? AdjustedTimeBySystem { get; set; }
    
    [Column("time_discrepance")]
    [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
    public int? TimeDiscrepance { get; set; }
    
    [Column("allow_discrepance")]
    public bool? AllowDiscrepance { get; set; }
    
    [Column("discrepance_allowed_reason")]
    public int? DiscrepanceAllowedReason { get; set; }
    
    [Column("discrepance_allowed_approved_by")]
    public String? DiscrepanceAllowedApprovedBy { get; set; }

    [Column("active")]
    public bool Active { get; set; } = true;
}