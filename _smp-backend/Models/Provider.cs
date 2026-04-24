using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("providers")]
    public class Provider
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }
        
        [Column("id_root")]
        public int IdRoot { get; set; }

        [Column("type", TypeName = "varchar(10)")]
        public string Type { get; set; }

        [Column("name", TypeName = "varchar(200)")]
        public string Name { get; set; }

        [Column("nameshort", TypeName = "varchar(30)")]
        public string NameShort { get; set; }

        [Column("rfc", TypeName = "varchar(13)")]
        public string? RFC { get; set; }

        [Column("address", TypeName = "varchar(100)")]
        public string? Address { get; set; }
        
        [Column("city", TypeName = "varchar(30)")]
        public string? City { get; set; }

        [Column("state", TypeName = "varchar(50)")]
        public string? State { get; set; }
        
        [Column("country", TypeName = "varchar(50)")]
        public string? Country { get; set; }

        [Column("phone", TypeName = "varchar(10)")]
        public string? Phone { get; set; }

        [Column("consortium", TypeName = "nvarchar(2)")]
        [DefaultValue("NO")]
        public string Consortium { get; set; }

        [Column("picture", TypeName = "varchar(250)")]
        public string? Picture { get; set; }
        
        [Column("email", TypeName = "varchar(100)")]
        public string? Email { get; set; }
        
        [Column("contact", TypeName = "varchar(100)")]
        public string? Contact { get; set; }

        [Column("active")]
        public short? Active { get; set; } = 1;
    }
}