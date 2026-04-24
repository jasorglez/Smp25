using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{
 
    [Table("accountbanks")]
    public class AccountBank
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_Bussines")]
        public int IdBussines { get; set; }

        [Required]
        [StringLength(20)]
        [Column("numberaccount")]
        public string NumberAccount { get; set; }

        [Required]
        [StringLength(70)]
        [Column("nameaccount")]
        public string NameAccount { get; set; }


        [StringLength(100)]
        [Column("signaccount")]
        public string SignAccount { get; set; }

        [Required]
        [StringLength(35)]
        [Column("Interbancaria")]
        public string Interbancaria { get; set; }


        [StringLength(12)]
        [Column("folioCheque")]
        public string FolioCheque { get; set; }


        [StringLength(12)]
        [Column("folioSinCheque")]
        public string FolioSinCheque { get; set; }

        [Column("id_banco")]
        public int IdBanco { get; set; }

        [StringLength(10)]
        [Column("maskin")]
        public string? Maskin { get; set; } = "Bi2-";

        [Column("consecin")]
        public int? Consecin { get; set; } = 0;

        [StringLength(10)]
        [Column("maskex")]
        public string? Maskex { get; set; } = "Bi2-";

        [Column("consecex")]
        public int? Consecex { get; set; } = 0;

        [StringLength(2)]
        [Column("eAplicaFiscal")]
        public string EAplicaFiscal { get; set; }


        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
