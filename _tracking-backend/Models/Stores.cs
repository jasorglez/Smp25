using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;
[Table("stores")]
public class Stores
{
    [Column("id")]
    public int Id { get; set; }
    [Column("id_branch")]
    public int IdBranch { get; set; }
    [Column("description")]
    public string? Description { get; set; }
    [Column("address")]
    public string? Address { get; set; }
    [Column("city")]
    public string? City { get; set; }
    [Column("state")]
    public string? State { get; set; }
    [Column("cp")]
    public string? Cp { get; set; }
    [Column("phone")]
    public string? Phone { get; set; }
    [Column("active")]
    public bool Active { get; set; } = true;
}