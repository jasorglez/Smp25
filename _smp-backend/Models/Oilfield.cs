using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("oilfields")]
    public class Oilfield
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        [Column("id", TypeName = "int")]
        public int Id { get; set; }

        [Column("id_contract", TypeName = "int")]        
        public int? ContractId { get; set; } = 1; // Matches SQL default

        [Column("name", TypeName = "varchar(100)")]
        public string? Name { get; set; }
        
        [Column("id_project", TypeName = "int")]
        public int? ProjectId { get; set; } = 1; // Matches SQL

        [Column("direccion", TypeName = "varchar(100)")]
        public string? Direccion { get; set; } = "SIN DIRECCION"; // Matches SQL default

        [Column("coordinates", TypeName = "varchar(100)")]        
        public string? Coordinates { get; set; } = "-00-"; // Matches SQL default

        [Column("place", TypeName = "varchar(50)")]        
        public string? Place { get; set; } = "PLACE"; // Matches SQL default

        [Column("namestate", TypeName = "varchar(50)")]        
        public string? NameState { get; set; } = "ESTADO"; // Matches SQL default

        [Column("active", TypeName = "smallint")]
        public short Active { get; set; } = 1; // Matches SQL default        
    }
}
