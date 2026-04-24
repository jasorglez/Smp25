using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.FE
{
    [Table("usocfdi", Schema = "FE")]
    public class UsoCfdi
    {
        [Key]
        public int Id { get; set; }

        [Column("c_UsoCFDI")]
        [StringLength(5)]
        public string? CUsoCFDI { get; set; }

        [Column("descripcion")]
        [StringLength(250)]
        public string? Descripcion { get; set; }

        [Column("aplicaparafisica")]
        [StringLength(2)]
        public string? AplicaParaFisica { get; set; }

        [Column("aplicaparamoral")]
        [StringLength(2)]
        public string? AplicaParaMoral { get; set; }

        [Column("iniciovigencia")]
        public DateTime? Iniciovigencia { get; set; }

        [Column("finvigencia")]
        public DateTime? Finvigencia { get; set; }

        [Column("regimenfiscal")]
        [StringLength(150)]
        public string? RegimenFiscal { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}