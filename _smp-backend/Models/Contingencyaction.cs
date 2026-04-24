using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("contingencyaction")]
    public class Contingencyaction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        
        [Column("actions")]
        public string Actions { get; set; }

        [Column("id_analysis")]
        public int idAnalysis { get; set; }

        [Required]
        [Column("datestart")]
        public DateTime DateStart { get; set; }

        [Required]
        [Column("dateend")]
        public DateTime DateEnd { get; set; }

        [StringLength(100)]
        public string? Period { get; set; }

        public string? Resources { get; set; }

        [Column("costaproxs")]
        public decimal? CostApprox { get; set; }

        [Column("advancedreal")]
        public decimal? AdvancedReal { get; set; } = 0;

        [Column("advanceplanned")]
        public decimal? AdvancePlanned { get; set; } = 0;

        public decimal? SPI { get; set; } = 0;

        public int? Days { get; set; } = 0;

        [StringLength(50)]
        public string Status { get; set; } = "Abierto";

        public string Observations { get; set; }

        [Column("active")]
        public short Active { get; set; } = 1;
    }
}