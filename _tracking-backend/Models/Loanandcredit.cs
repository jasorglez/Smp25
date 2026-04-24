using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("loansandcredits")]
    public class Loanandcredit
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("Id")]
        public int Id { get; set; }

        [Column("id_empleado")]
        public int? IdEmpleado { get; set; }

        [Column("monto")]
        public decimal? Monto { get; set; }

        [Column("payments")]
        public decimal? Payments { get; set; } = 0;
        
        [Column("remain")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal? Remain => Monto - Payments;

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("type")]
        [StringLength(10)]
        public string Type { get; set; }

        [Column("fromPayroll")]
        public bool? FromPayroll { get; set; }

        [Column("comments")]
        [StringLength(255)]
        public string? Comments { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}