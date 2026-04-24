using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("zipcodes")]
public class ZipCodes
{
    [Key]
    [Column("id")]
    public int Id { get; set; }
    
    [Column("cp", TypeName = "nvarchar(max)")]
    public string Cp { get; set; }

    [Column("estado", TypeName = "nvarchar(max)")]
    public string? Estado { get; set; }

    [Column("ciudad", TypeName = "nvarchar(max)")]
    public string? Ciudad { get; set; }

    [Column("asentamiento", TypeName = "nvarchar(max)")]
    public string? Asentamientos { get; set; }
}