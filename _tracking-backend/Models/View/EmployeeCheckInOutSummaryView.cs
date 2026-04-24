using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View;

[Table("EmployeeCheckInOutSummary")]
public class EmployeeCheckInOutSummaryView
{
    [Column("id_employee")]
    public int IdEmployee { get; set; }

    [Column("employee_name")]
    public string EmployeeName { get; set; }

    [Column("id_branch")]
    public int IdBranch { get; set; }

    [Column("date")]
    public DateTime Date { get; set; }

    [Column("real_check_in1")]
    public TimeSpan? RealCheckIn1 { get; set; }

    [Column("adjusted_check_in1")]
    public TimeSpan? AdjustedCheckIn1 { get; set; }

    [Column("real_check_out1")]
    public TimeSpan? RealCheckOut1 { get; set; }

    [Column("adjusted_check_out1")]
    public TimeSpan? AdjustedCheckOut1 { get; set; }

    [Column("real_check_in2")]
    public TimeSpan? RealCheckIn2 { get; set; }

    [Column("adjusted_check_in2")]
    public TimeSpan? AdjustedCheckIn2 { get; set; }

    [Column("real_check_out2")]
    public TimeSpan? RealCheckOut2 { get; set; }

    [Column("adjusted_check_out2")]
    public TimeSpan? AdjustedCheckOut2 { get; set; }

    [Column("real_journey", TypeName = "decimal(18,2)")]
    public decimal RealJourney { get; set; }

    [Column("adjusted_journey", TypeName = "decimal(18,2)")]
    public decimal AdjustedJourney { get; set; }

    [Column("pending_check_outs")]
    public int PendingCheckOuts { get; set; }

    [Column("edited")]
    public bool Edited { get; set; } = false;

    [Column("edited_by")]
    public int? EditedBy { get; set; }

    [Column("valid")]
    public bool Valid { get; set; }
}
