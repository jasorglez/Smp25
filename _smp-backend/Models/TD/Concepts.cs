using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SMP.Models.TD
{
    [Table("concepts", Schema = "TD")]
    public class Concepts
    {
        [Key]
        public int Id { get; set; }
        
        [Column("id_company")]
        public int IdCompany { get; set; }

        [Column("description")]
        [StringLength(50)]
        public string? Description { get; set; }

        [Column("internal_team_value")]
        [Precision(18, 2)]
        public decimal? InternalTeamValue { get; set; }

        [Column("external_team_value")]
        [Precision(18, 2)]
        public decimal? ExternalTeamValue { get; set; }

        [Column("active")]
        [Required]
        public bool Active { get; set; } = true;
    }
}
