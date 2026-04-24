using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View;

[Table("v_employee_checkinsouts")]
public class EmployeesxCheckInsOutsView
{
    [Column("id")]
    public int Id { get; set; }

    [Column("id_employee")]
    public int IdEmployee { get; set; }

    [Column("employee_name")]
    public string EmployeeName { get; set; }

    [Column("id_branch")]
    public int IdBranch { get; set; }

    [Column("namebranch")]
    public string? NameBranch { get; set; }

    [Column("date")]
    public DateOnly Date { get; set; }

    [Column("hour")]
    public TimeOnly Hour { get; set; }

    [Column("type")]
    public string Type { get; set; }

    [Column("valid")]
    public bool Valid { get; set; }

    [Column("minuteDiscount")]
    public decimal? MinuteDiscount { get; set; } = 0;

    [Column("active")]
    public bool Active { get; set; } = true;
}