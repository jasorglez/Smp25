using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("formapago", Schema = "FE")]
    public class FormaPago
    {
        [Key]
        public int Id { get; set; }

        [Column("formapago")]
        [StringLength(10)]
        public string? FormaPagoValue { get; set; }

        [Column("descripcion")]
        [StringLength(70)]
        public string? Descripcion { get; set; }

        [Column("bancarizado")]
        [StringLength(9)]
        public string? Bancarizado { get; set; }

        [Column("numerooperacion")]
        [StringLength(8)]
        public string? NumeroOperacion { get; set; }

        [Column("rfcemisor")]
        [StringLength(10)]
        public string? RfcEmisor { get; set; }

        [Column("cuentaordenante")]
        [StringLength(10)]
        public string? CuentaOrdenante { get; set; }

        [Column("patronordenante")]
        [StringLength(90)]
        public string? PatronOrdenante { get; set; }

        [Column("rfcemisorbeneficiario")]
        [StringLength(10)]
        public string? RfcEmisorBeneficiario { get; set; }

        [Column("cuentabenfeficiario")]
        [StringLength(10)]
        public string? CuentaBeneficiario { get; set; }

        [Column("patronbeneficiario")]
        [StringLength(90)]
        public string? PatronBeneficiario { get; set; }

        [Column("tipocadena")]
        [StringLength(10)]
        public string? TipoCadena { get; set; }

        [Column("nombredelbanco")]
        [StringLength(150)]
        public string? NombreDelBanco { get; set; }

        [Column("iniciovigencia")]
        public DateTime? InicioVigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? FinVigencia { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}