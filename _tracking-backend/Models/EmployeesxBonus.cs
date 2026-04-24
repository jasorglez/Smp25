using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Runtime.InteropServices.JavaScript;

namespace MicroServicioTracking.Models
{
    [Table("EmployeesxBonus") ]
    public class EmployeesxBonus
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("id_employee")]
        public int? IdEmployee { get; set; }

        [Column("id_bonus")]
        public int? IdBonus { get; set; }

        [Column("employeeName")]
        public string? EmployeeName { get; set; }

        [Column("incidenceDate")]
        public DateTime IncidenceDate { get; set; }

        /*[Column("bonus")]
        public string? Bonus { get; set; }*/

        /* [Column("quantity")]
         public Decimal Quantity { get; set; }*/
         
        [Column("fromPayroll")]
        public bool? FromPayroll { get; set; }

        public bool? Vigente { get; set; }
        public bool? Active { get; set; }

        public override string ToString()
        {
            return $"EmployeeXBonusId: {Id}, IdBranch: {IdBranch}, IdEmployee: {IdEmployee}, IdBonus: {IdBonus}, Name: {EmployeeName}, Fecha: {IncidenceDate}"; // Personaliza según tus propiedades
        }
    }

  

}