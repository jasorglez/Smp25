using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

    [Table("estimates", Schema = "dbo")]
    public class Estimate
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [StringLength(20)]
        public string Number { get; set; }

        [Required]
        [Column("id_businnes")]
        public int IdRoot { get; set; }

        [Required]
        [Column("id_contract")]
        public int IdContract { get; set; }

        [Required]
        [StringLength(5)]
        [Column("typemoney")]
        public string TypeMoney { get; set; }

        [Column("datestart")]
        public DateTime? DateStart { get; set; }

        [Column("dateend")]
        public DateTime? DateEnd { get; set; }

        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int? Dias { get; private set; }

        [Required]
        [Column("amountMX")]
        [Precision(16, 3)]
        public decimal AmountMX { get; set; }

        [Required]
        [Column("amountDLL")]
        [Precision(16, 3)]
        public decimal AmountDLL { get; set; }

        [Required]
        [Column("acumulateMX")]
        [Precision(16, 3)]
        public decimal AcumulateMX { get; set; }

        [Required]
        [Column("acumulateDLL")]
        [Precision(16, 3)]
        public decimal AcumulateDLL { get; set; }

        [Required]
        [StringLength(10)]
        [Column("type")]
        public string? Type { get; set; }

        [Required]
        [Column("authorizeuser")]
        [StringLength(40)]
        public string AuthorizeUser { get; set; }

        [Column("comment")]
        [StringLength(50)]        
        public string? Comment { get; set; }

        [Required]
        [Column("active")]
        public bool Active { get; set; }
    }
}