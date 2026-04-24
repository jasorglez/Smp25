using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{
    [Table("grupos_corporativos")]
    public class GruposCorporativo
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("name", TypeName = "nvarchar(50)")]
        public string? Name { get; set; }

        [Column("partner1", TypeName = "varchar(90)")]
        public string? Partner1 { get; set; }

        [Column("partner2", TypeName = "varchar(90)")]
        public string? Partner2 { get; set; }

        [Column("partner3", TypeName = "varchar(90)")]
        public string? Partner3 { get; set; }

        [Column("partner4", TypeName = "varchar(90)")]
        public string? Partner4 { get; set; }

        [Column("partner5", TypeName = "varchar(90)")]
        public string? Partner5 { get; set; }

        [Column("image", TypeName = "varchar(250)")]
        public string? Image { get; set; }

        [Column("comment", TypeName = "nvarchar(100)")]
        public string? Comment { get; set; }

        [Column("active")]
        public bool? Active { get; set; } = true;
    }
}
