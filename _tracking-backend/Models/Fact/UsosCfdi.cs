using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("usos_cfdi", Schema = "fact")]
public class UsosCfdi
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_usos_cfdi")]
    public String IdUsosCfdi { get; set; }
    
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
    
    [Column("regimenes_fiscales_receptores")]
    public String? RegimenesFiscalesReceptores { get; set; }
}