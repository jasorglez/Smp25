using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("claves_unidades", Schema = "fact")]
public class ClavesUnidades
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_claves_unidades")]
    public String IdClavesUnidades { get; set; }
    
    [Column("texto")]
    public String? Texto { get; set; }
    
    [Column("descripcion")]
    public String? Descripcion { get; set; }
    
    [Column("notas")]
    public String? Notas { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
    
    [Column("simbolo")]
    public String? Simbolo { get; set; }
}