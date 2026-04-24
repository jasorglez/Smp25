using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("metodos_pago", Schema = "fact")]
public class MetodosPago
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_metodos_pago")]
    public String IdMetodosPago { get; set; }
    
    [Column("texto")]
    public String? Texto { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
}