using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

    [Table("identification")]
    public class Identification
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_project")]
        public int? IdProject { get; set; }

        [StringLength(10)]
        [Column("event")]
        public string Event { get; set; } = "ID01";

        [StringLength(15)]
        [Column("clasification")]
        public string Clasification { get; set; } = "Administrativo";

        [Column("dateregistry")]
        public DateTime? DateRegistry { get; set; }

        [Column("description")]
        public string Description { get; set; }

        [Column("cause")]
        public string Cause { get; set; }

        [StringLength(15)]
        [Column("administrator")]
        public string Administrator { get; set; } = "Pemex";

        [Column("active")]
        public short Active { get; set; } = 1;
    }
}