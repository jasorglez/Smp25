using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("regimenes_fiscales", Schema = "fact")]
public class RegimenesFiscales
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_regimenes_fiscales")]
    public String IdRegimenesFiscales { get; set; }
    
    [Column("texto")]
    public String? Texto { get; set; }
    
    [Column("aplica_fisica")]
    public String? AplicaFisica { get; set; }
    
    [Column("aplica_moral")]
    public String? AplicaMoral { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
}