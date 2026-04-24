using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table(("billingmanagement"))]
public class BillingManagement
{
    [Key]
    [Column("id")]
    public int Id { get; set; }

    [Column("id_root")]
    public int IdRoot { get; set; }

    // datos para la emision de facturas
    [Column("emisor_rfc")]
    [StringLength(14)]
    public string? EmisorRfc { get; set; }

    [Column("emisor_nombre")]
    [StringLength(300)]
    public string? EmisorNombre { get; set; }

    [Column("emisor_cp")]
    [StringLength(5)]
    public string? EmisorCp { get; set; }


    [Column("fiscal_year")]
    public int FiscalYear { get; set; }

    [Column("fiscal_regime")]
    public int FiscalRegime { get; set; }

    [Column("prefix")]
    public string? Prefix { get; set; }

    [Column("consecutive")]
    public int Consecutive { get; set; }

    [Column("prefixexp")]
    public string? Prefixexp { get; set; }

    [Column("consecutivexp")]
    public int Consecutivexp { get; set; }

    [Column("i_iva")]
    public Decimal IIva { get; set; }

    [Column("i_ieps")]
    public Decimal IIeps { get; set; }

    [Column("i_i3")]
    public Decimal II3 { get; set; }

    [Column("r_iva")]
    public Decimal RIva { get; set; }

    [Column("r_ieps")]
    public Decimal RIeps { get; set; }

    [Column("efirma_pass")]
    public string EfirmaPass { get; set; }

    [Column("dateStart")]
    public DateTime? DateStart { get; set; }

    [Column("dateEnd")]
    public DateTime? DateEnd { get; set; }

    // Archivos de certificados guardados como binarios en la BD
    [Column("cer_file_content")]
    public byte[]? CerFileContent { get; set; }

    [Column("key_file_content")]
    public byte[]? KeyFileContent { get; set; }

    [Column("active")]
    public bool Active { get; set; } = true;

}