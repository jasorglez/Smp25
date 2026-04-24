using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table(("setuphrbyroot"))]
public class HRManagementByRoot
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_root")]
    public int IdRoot { get; set; }

    [Column("prefix")]
    public string? Prefix { get; set; }

    [Column("consecutive")]
    public int Consecutive { get; set; } = 0;
    
    [Column("active")]
    public bool Active { get; set; } = true;

}