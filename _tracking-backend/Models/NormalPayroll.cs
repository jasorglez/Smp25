using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("normalpayroll")]
    public class NormalPayroll
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_branch")]
        public int IdBranch { get; set; }

        [Column("id_block_period")]
        public int? IdBlockPeriod { get; set; }

        [Column("startdate")]
        public DateTime StartDate { get; set; }

        [Column("enddate")]
        public DateTime EndDate { get; set; }

        [Column("totalbaseworkinghours")]
        public decimal? TotalBaseWorkingHours { get; set; }

        [Column("totalbaseextrahours")]
        public decimal? TotalBaseExtraHours { get; set; }

        [Column("totalBaseExtraHoursSpecial")]
        public decimal? TotalBaseExtraHoursSpecial { get; set; }

        [Column("totalBaseSalary")]
        public decimal? TotalBaseSalary { get; set; }

        [Column("totalExtraSalary")]
        public decimal? TotalExtraSalary { get; set; }

        [Column("totalSpecialSalary")]
        public decimal? TotalSpecialSalary { get; set; }

        [Column("totalbonos")]
        public decimal? TotalBonos { get; set; }

        [Column("totalsubtotal")]
        public decimal? TotalSubtotal { get; set; }

         [Column("totalSavings")]
        public decimal? TotalSavings { get; set; }

        [Column("totaldescuentos")]
        public decimal? TotalDescuentos { get; set; }

        [Column("totalDigitalPayment")]
        public decimal? TotalDigitalPayment { get; set; }

        [Column("total")]
        public decimal? Total { get; set; }

        [Column("nomDigital")]
        public bool NomDigital { get; set; }

        [Column("closed")]
        public bool? Closed { get; set; }

        [Column("total_Absence")]
        public decimal? TotalAbsence { get; set; }

        [Column("total_Delays")]
        public decimal? TotalDelays { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    


    // Relaciones
        public virtual ICollection<EmployeesByPayroll> EmployeesByPayroll { get; set; } = new List<EmployeesByPayroll>();
    }

    // Modelo para la tabla payrollbyemployees
    public class EmployeesByPayroll
    {
        public int Id { get; set; }
        public int Id_employee { get; set; }
        public int Id_normalpayroll { get; set; }
        public decimal PriceXHour {get; set; }
        public decimal WorkedHours { get; set; }
        public decimal ExtraWorkedHours { get; set; }

        public decimal SpecialWorkedHours { get; set; } 

        [Column(TypeName = "decimal(18,4)")]
        public decimal BaseSalary { get; set; }
        public decimal ExtraSalary { get; set; }
        public decimal SpecialSalary { get; set; } 
        public decimal Bonus { get; set; }
        public decimal GrossSalary { get; set; }
        public decimal PercentageDiscount { get; set; }
        public decimal realDiscount { get; set; }
        public decimal DigitalPayment { get; set; }
        public decimal Savings { get; set; }
        public decimal Absences { get; set; }
        public decimal Delays { get; set; }
        public decimal Total { get; set; }
        public bool Active { get; set; }

        // Relaciones
        public virtual NormalPayroll? NormalPayroll { get; set; }
        public virtual Employee Employee { get; set; }
    }
    
}