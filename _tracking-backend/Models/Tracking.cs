using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{
    [Table("trackings")]
    public class Tracking
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("company", TypeName = "varchar(50)")]
        public string? Company { get; set; }

        [Column("datetime", TypeName = "datetime")]
        public DateTime? Datet { get; set; }

        [Column("description", TypeName = "varchar(200)")]
        public string? Description { get; set; }

        [Column("origin", TypeName = "nchar(50)")]
        public string? Origin { get; set; }

        [Column("user", TypeName = "varchar(80)")]
        public string? User { get; set; }
    }
}