using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models
{
    [Table("PayrollRecords")]
    public class PayrollRecord
    {
        [Key]
        public int PayrollId { get; set; }       
        public int IdBranch { get; set; }
        public int? IdBlockPeriod { get; set; }

        [Required]
        [StringLength(100)]
        public string Company { get; set; }

        [Required]
        [StringLength(100)]
        public string Period { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }

        [Required]
        [StringLength(20)]
        public string FiscalYear { get; set; }

        public byte[]? ExcelFile { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.Now;

        [Required]
        public bool Active { get; set; } = true;

        // Updated navigation property to use the new entity name
        public virtual ICollection<PayrollEmployee> PayrollEmployees { get; set; }
    }
}
