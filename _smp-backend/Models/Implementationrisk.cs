using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("implementationrisk")]
    public class Implementationrisk
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Required]
        [Column("id_planification")]
        public int IdPlanification { get; set; }

        [Required]
        [Column("probability")]
        [DefaultValue(0)]
        public int Probability { get; set; }

        [Required]
        [Column("reach")]
        [DefaultValue(0)]
        public int Reach { get; set; }

        [Required]
        [Column("time")]
        [DefaultValue(0)]
        public int Time { get; set; }

        [Required]
        [Column("cost", TypeName = "decimal(16,2)")]
        [DefaultValue(0.0)]
        public decimal Cost { get; set; }

        [Required]
        [Column("quality")]
        [DefaultValue(0)]
        public int Quality { get; set; }

        [Required]
        [Column("qualification")]
        [DefaultValue(0)]
        public int Qualification { get; set; }

        [Required]
        [Column("state", TypeName = "varchar(40)")]
        [DefaultValue("PLAN DE RESPUESTA")]
        public string State { get; set; }

        [Required]
        [Column("advancedreal")]
        [DefaultValue(0)]
        public int AdvancedReal { get; set; }

        [Required]
        [Column("advancedplanning")]
        [DefaultValue(0)]
        public int AdvancedPlanning { get; set; }

        [Column("spi", TypeName = "decimal(16,2)")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public decimal? Spi { get; private set; }

        [Required]
        [Column("status", TypeName = "varchar(10)")]
        [DefaultValue("STATUS")]
        public string Status { get; set; }

        [Required]
        [Column("condition", TypeName = "varchar(10)")]
        [DefaultValue("CONDITION")]
        public string Condition { get; set; }

        [Column("dateclose")]
        public DateTime? DateClose { get; set; }

        [Required]
        [Column("observation", TypeName = "varchar(40)")]
        [DefaultValue("OBSERVATIONS")]
        public string Observation { get; set; }

        [Required]
        [Column("active")]
        [DefaultValue(1)]
        public bool Active { get; set; }
             
    }
}