using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("changescontrol")]
    public class Changescontrol
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Required]
        [Column("id_project")]
        public int IdProject { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Required]
        [Column("concept")]
        [StringLength(350)]
        public string Concept { get; set; }

        [Required]
        [Column("scope")]
        [StringLength(180)]
        public string Scope { get; set; }

        [Required]
        [Column("time")]
        [StringLength(180)]
        public string Time { get; set; }

        [Required]
        [Column("cost")]
        [StringLength(180)]
        public string Cost { get; set; }

        [Required]
        [Column("coordinate")]
        [StringLength(90)]
        public string Coordinate { get; set; }

        [Required]
        [Column("resident")]
        [StringLength(90)]
        public string Resident { get; set; }

        [Required]
        [Column("supervisor")]
        [StringLength(90)]
        public string Supervisor { get; set; }

        [Column("startdate")]
        public DateTime? StartDate { get; set; }

        [Column("enddate")]
        public DateTime? EndDate { get; set; }

        [Required]
        [Column("amount")]
        [Precision(18, 0)]
        public decimal Amount { get; set; }

        [Required]
        [Column("observation")]
        [StringLength(200)]
        public string Observation { get; set; }

        [Required]
        [Column("authorizeuser")]
        [StringLength(40)]
        public string AuthorizeUser { get; set; }

        [Required]
        [Column("active")]
        public bool Active { get; set; }
    }
}