using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("planificationrisk")]
    public class PlanificationRisk
    {
        [Key]
        [Column("int")]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_analisis")]
        public int? IdAnalisis { get; set; }

        [Column("actions")]
        public string Actions { get; set; }

        [Column("startdate")]
        public DateTime? StartDate { get; set; }

        [Column("enddate")]
        public DateTime? EndDate { get; set; }

        [Column("period")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)]
        public int? Period { get; private set; }

        [Column("resources")]
        public string Resources { get; set; }

        [Column("cost")]
        public string Cost { get; set; }

        [Column("active")]
        public bool? Active { get; set; }
    }
}