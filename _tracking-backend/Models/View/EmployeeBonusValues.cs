using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Models.View
{
    [Table("EmployeeBonusValues")]
    [Keyless]
    public class EmployeeBonusValues
    {
        [Column("id_employee")]
        public int IdEmployee { get; set; }

        [Column("id_branch")]
        public int IdBranch { get; set; }

        [Column("id_bonus")]
        public int IdBonus { get; set; }

        [Column("incidenceDate")]
        public DateTime IncidenceDate { get; set; }

        [Column("ValueAddition")]
        public decimal ValueAddition { get; set; }
    }
}
