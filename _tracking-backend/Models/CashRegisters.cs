using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("cashregisters")]
public class CashRegisters
{
    [Column("id")]
    public int Id { get; set; }
    
    [Column("id_store")]
    public int IdStore { get; set; }
    
    [Column("description")]
    public string? Description { get; set; }
    
    [Column("comment")]
    public string? Comment { get; set; }
    
    [Column("active")]
    public bool Active { get; set; } = true;
}