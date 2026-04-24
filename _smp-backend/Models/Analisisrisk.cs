
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("analysisrisk")]
    public class Analysisrisk
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_identification")]
        public int? IdIdentification { get; set; }

        [Column("id_program")]
        public int? IdProgram { get; set; }

        [Column("startdate")]
        public DateTime? StartDate { get; set; }

        [Column("enddate")]
        public DateTime? EndDate { get; set; }

        [Column("routecritic")]
        [StringLength(2)]
        public string RouteCritic { get; set; }

        [Column("probability")]
        public int? Probability { get; set; }

        [Column("scope")]
        public int? Scope { get; set; }

        [Column("time")]
        public int? Time { get; set; }

        [Column("cost")]
        public int? Cost { get; set; }

        [Column("quality")]
        public int? Quality { get; set; }

        [Column("average")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int? Average { get; private set; }

        [Column("calification")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int? Calification { get; private set; }

        [Column("urgency")]
        public string Urgency { get; set; }

        [Column("fase")]
        [StringLength(100)]
        public string? IdFase { get; set; }

        [Column("answer")]
        [StringLength(20)]
        public string Answer { get; set; }

        [Column("active")]
        public bool? Active { get; set; }
    }
}