  
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{

    [Table("courserInfo")]
    public class CourserInfo
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id")]
        public int Id { get; set; }

        [Column("date")]
        public DateTime Date { get; set; }

        [Column("curso")]
        public string Curso { get; set; }

        [Column("escolaridad")]
        public string Escolaridad { get; set; }

        [Column("institucion")]
        public string Institucion { get; set; }

        [Column("nombre")]
        public string Nombre { get; set; }

        [Column("contacto")]
        public string Contacto { get; set; }

        [Column("atendido")]
        public bool Atendido { get; set; }

        [Column("active")]
        public bool Active { get; set; }
    }
}
