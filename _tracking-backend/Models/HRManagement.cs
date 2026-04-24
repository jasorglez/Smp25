using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore.Metadata.Internal;

namespace MicroServicioTracking.Models;

[Table(("setuphr"))]
public class HRManagement
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_branch")]
    public int? IdBranch { get; set; } 
    
    [Column("vigency")]
    public int? Vigency { get; set; }

    [Column("start_day")]
    public string StartDay { get; set; }

    [Column("clock_tolerance")]
    public int? ClockTolerance { get; set; }
    
    [Column("delay_1")] 
    public int? Delay1 { get; set; }

    [Column("delay_2")] 
    public int? Delay2 { get; set; }
    
    [Column("discount_1")]
    public bool Discount1 { get; set; }
    [Column("discount_2")]
    public bool Discount2 { get; set; } 

    [Column("discount")]
    public decimal? Discount { get; set; }

    [Column("payrollPeriod")]
    public int? PayrollPeriod { get; set; }

    [Column("overtimePay")]
    public decimal? OvertimePay { get; set; }

    [Column("specialOvertimePay")]
    public decimal? SpecialOvertimePay { get; set; }

    [Column("settingToleranceTime")]
    public decimal? SettingToleranceTime { get; set; }

    [Column("identificationBlockPeriod")]
    public string? IdentificationBlockPeriod { get; set; }

    [Column("active")]
    public bool Active { get; set; }

}