using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("formas_pago", Schema = "fact")]
public class FormasPago
{
    [Key]
    public int Id { get; set; }
    
    [Column("id_formas_pago")]
    public String IdFormasPago { get; set; }
    
    [Column("texto")]
    public String? Texto { get; set; }
    
    [Column("es_bancarizado")]
    public String? EsBancarizado { get; set; }
    
    [Column("requiere_numero_operacion")]
    public String? RequiereNumeroOperacion { get; set; }
    
    [Column("permite_banco_ordenante_rfc")]
    public String? PermiteBancoOrdenanteRfc { get; set; }
    
    [Column("permite_cuenta_ordenante")]
    public String? PermiteCuentaOrdenante { get; set; }
    
    [Column("patron_cuenta_ordenante")]
    public String? PatronCuentaOrdenante { get; set; }
    
    [Column("permite_banco_beneficiario_rfc")]
    public String? PermiteBancoBeneficiarioRfc { get; set; }
    
    [Column("permite_cuenta_beneficiario")]
    public String? PermiteCuentaBeneficiario { get; set; }
    
    [Column("patron_cuenta_beneficiario")]
    public String? PatronCuentaBeneficiario { get; set; }
    
    [Column("permite_tipo_cadena_pago")]
    public String? PermiteTipoCadenaPago { get; set; }
    
    [Column("requiere_banco_ordenante_nombre_ext")]
    public String? RequiereBancoOrdenanteNombreExt { get; set; }
    
    [Column("vigencia_desde")]
    public String? VigenciaDesde { get; set; }
    
    [Column("vigencia_hasta")]
    public String? VigenciaHasta { get; set; }
}