
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.Fact;

[Table("customers_billing")]
public class CustomersBilling
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("id_customer")]
    public int IdCustomer { get; set; }

    [Column("id_root")]
    public int IdRoot { get; set; }

    [Column("rfc")]
    [StringLength(14)]
    public string Rfc { get; set; } = string.Empty;

    [Column("nombre_fiscal")]
    [StringLength(300)]
    public string NombreFiscal { get; set; } = string.Empty;

    [Column("codigo_postal")]
    [StringLength(5)]
    public string CodigoPostal { get; set; } = string.Empty;

    [Column("regimen_fiscal")]
    [StringLength(20)]
    public string RegimenFiscal { get; set; } = string.Empty;

    [Column("uso_cfdi")]
    [StringLength(20)]
    public string UsoCfdi { get; set; } = string.Empty;

    [Column("correo_facturacion")]
    [StringLength(80)]
    public string? CorreoFacturacion { get; set; }
       
    [Column("active")]
    public bool Active { get; set; } = true;



    
}