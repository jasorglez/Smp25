using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("employeesxclock")]
public class EmployeesXClock
{
    [Key]
    [Column("id")]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }
    
    [Column("id_employee")]
    public int IdEmployee { get; set; }
    
    [Column("day")]
    public string Day { get; set; }

    [Column("enabled")]
    public bool Enabled { get; set; } = false;
    
    [Column("entry_1")]
    public TimeOnly? Entry1 { get; set; }
    
    [Column("exit_1")]
    public TimeOnly? Exit1 { get; set; }
    
    [Column("entry_2")]
    public TimeOnly? Entry2 { get; set; }
    
    [Column("exit_2")]
    public TimeOnly? Exit2 { get; set; }
    
    [Column("active")]
    public bool Active { get; set; } = true;
}