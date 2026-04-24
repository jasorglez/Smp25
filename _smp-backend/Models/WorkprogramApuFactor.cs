using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("workprogram_apu_factors", Schema = "pu")]
    public class WorkprogramApuFactor
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_contract")]
        public int IdContract { get; set; }

        [Column("name", TypeName = "varchar(50)")]
        public string Name { get; set; } = string.Empty;

        [Column("percentage", TypeName = "decimal(8,4)")]
        [DefaultValue(0)]
        public decimal Percentage { get; set; }

        [Column("sort_order")]
        [DefaultValue(0)]
        public int SortOrder { get; set; }

        [Column("active")]
        [DefaultValue(true)]
        public bool Active { get; set; } = true;
    }
}
