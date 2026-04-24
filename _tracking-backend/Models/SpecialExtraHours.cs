using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("specialextrahours")]
public class SpecialExtraHours
{ 
 [Column("id")]
 [Key]
 public int Id { get; set; }
 
 [Column("id_employee")]
 public int IdEmployee { get; set; }
 
 [Column("start_date")]
 public DateTime StartDate { get; set; }
 
 [Column("end_date")]
 public DateTime EndDate { get; set; }
 
 
 [Column("special_extra_hours_in_minutes")]
 [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
 public int CalculatedSpecialExtraHoursInMinutes { get; private set; }

 [Column("active")] public bool Active { get; set; } = true;
}