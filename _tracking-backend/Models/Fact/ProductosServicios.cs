using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("productos_servicios", Schema = "fact")]
public class ProductosServicios
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_productos_servicios")]
    public String IdProductosServicios { get; set; }
    
    [Column("texto")]
    public String? Texto { get; set; }
    
    [Column("iva_trasladado")]
    public String? IvaTrasladado { get; set; }
    
    [Column("ieps_trasladado")]
    public String? IepsTrasladado { get; set; }
    
    [Column("complemento")]
    public String? Complemento { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
    
    [Column("estimulo_frontera")]
    public String? EstimuloFrontera { get; set; }
    
    [Column("similares")]
    public String? Similares { get; set; }
}