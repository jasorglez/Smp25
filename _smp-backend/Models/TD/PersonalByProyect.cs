using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace SMP.Models.TD
{
    [Table("personalByProyect", Schema = "TD")]
    public class PersonalByProyect
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_proyect")]
        public int IdProyect { get; set; }
        
        [Column("id_personal")]
        public int IdPersonal { get; set; }

        [Column("active")]
        public bool Active { get; set; } = true;
    }
}
