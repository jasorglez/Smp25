using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("codigos_postales", Schema = "fact")]
public class CodigosPostales
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_codigos_postales")]
    public String IdCodigosPostales { get; set; }
    
    [Column("estado")]
    public String? Estado { get; set; }
    
    [Column("municipio")]
    public String? Municipio { get; set; }
    
    [Column("localidad")]
    public String? Localidad { get; set; }
    
    [Column("estimulo_frontera")]
    public String? EstimuloFrontera { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
    
    [Column("huso_descripcion")]
    public String? HusoDescripcion { get; set; }
    
    [Column("huso_horario_mes_inicio")]
    public String? HusoHorarioMesInicio { get; set; }
    
    [Column("huso_horario_dia_inicio")]
    public String? HusoHorarioDiaInicio { get; set; }
    
    [Column("huso_horario_hora_inicio")]
    public String? HusoHorarioHoraInicio { get; set; }
    
    [Column("huso_verano_diferencia")]
    public String? HusoVeranoDiferencia { get; set; }
    
    [Column("huso_invierno_mes_inicio")]
    public String? HusoInviernoMesInicio { get; set; }
    
    [Column("huso_invierno_dia_inicio")]
    public String? HusoInviernoDiaInicio { get; set; }
    
    [Column("huso_invierno_hora_inicio")]
    public String? HusoInviernoHoraInicio { get; set; }
    
    [Column("huso_invierno_diferencia")]
    public String? HusoInviernoDiferencia { get; set; }
}