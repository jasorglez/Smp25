using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("PayrollEmployees")] // Changed table name to avoid conflict
    public class PayrollEmployee
    {
        [Key]
        public int PayrollEmployeeId { get; set; }
        public int? EmployeeId {get; set;}

        [Required]
        [StringLength(100)]
        public string Name { get; set; }
        
        [Column]
        public int WorkedDays { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal IntegratedDailySalary { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal DailySalary { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Wages { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalEarnings { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OtherIncome { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxableEarnings { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Article96Tax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal Article114Subsidy { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalArticle115EmploymentSubsidy { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AccreditedEmploymentSubsidy { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal IncomeTax { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal EmploymentSubsidy { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal MedicalInsurance { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal RetirementInsurance { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SocialSecurity { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal HousingFundWithholding { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal ChildSupport { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal NetPay { get; set; }
        public string? Signature { get; set; }

        // Foreign key
        public int PayrollId { get; set; }

        // Navigation property
        [ForeignKey("PayrollId")]
        public virtual PayrollRecord PayrollRecord { get; set; }
    }
}
