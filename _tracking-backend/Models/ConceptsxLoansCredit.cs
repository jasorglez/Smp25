
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("conceptsxloanscredits")]
    public class ConceptsxLoansCredit
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_loanandcredit")]
        public int IdLoanAndCredit { get; set; }  // Corrected name

        [Column("date")]
        public DateTime Date { get; set; } = DateTime.Now; // Initialize to current date

        [Column("total")]
        public decimal Total { get; set; }

        [Column("status")]
        [StringLength(10)]
        public string Status { get; set; } = "Pendiente"; // Default value

        [Column("comments")]
        [StringLength(100)]
        public string Comments { get; set; } = "NINGUNO"; // Default value

        [Column("fromPayroll")]
        public bool? FromPayroll { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
        

    }
}