using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace SMP.Models
{

        [Table("root")]
        public class Root
        {
            [Key]
            [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
            [Column("id")]
            public int Id { get; set; }

            [Column("name", TypeName = "nvarchar(80)")]
            public string? Name { get; set; }

            [Column("email", TypeName = "nvarchar(50)")]
            public string? Email { get; set; }

            [Column("web", TypeName = "nvarchar(70)")]
            public string? Web { get; set; }

            [Column("city", TypeName = "nvarchar(50)")]
            public string? City { get; set; }

            [Column("cp", TypeName = "nvarchar(15)")]
            public string? Cp { get; set; }

            [Column("country", TypeName = "nvarchar(50)")]
            public string? Country { get; set; }

            [Column("formatrep", TypeName = "nvarchar(50)")]
            public string? FormatRep { get; set; }

            [Column("namesmall", TypeName = "nvarchar(10)")]
            public string? NameSmall { get; set; }

            [Column("phone", TypeName = "nvarchar(18)")]
            public string? Phone { get; set; }
            //logo de la esquina
            [Column("picture", TypeName = "varchar(300)")]
            public string? Picture { get; set; }
            //logo del header o Encabezado
            [Column("picture2", TypeName = "varchar(300)")]
            public string? Picture2 { get; set; }
            //logo del footer o pie pagina
            [Column("picture3", TypeName = "varchar(300)")]
            public string? Picture3 { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Ffooter.png?alt=media&token=068103a6-7be8-4124-976a-7ea506313a46";

            [Column("rfc", TypeName = "varchar(14)")]
            public string? RFC { get; set; }

            [Column("state", TypeName = "varchar(40)")]
            public string? State { get; set; }
            
            [Column(name:"address", TypeName = "varchar(200)")]
            public string? Address { get; set; }

            [Column("person_type")]
            [Required]
            public string PersonType { get; set; } = "MORAL";

            [Column("advanced")]
            public bool? Advanced { get; set; }

            [Column("orden")]
            public int Orden { get; set; }

            [Column("active")]
            public short Active { get; set; } = 1;

            [Column("id_corporativo")]
            public int? IdCorporativo { get; set; }

            [Column("license_start")]
            public DateTime? LicenseStart { get; set; }

            [Column("license_days")]
            public int LicenseDays { get; set; } = 15;

            [Column("license_type", TypeName = "varchar(20)")]
            public string LicenseType { get; set; } = "trial";

            /// <summary>Calculado en memoria — no mapeado a columna.</summary>
            [NotMapped]
            public string LicenseStatus =>
                LicenseStart == null ? "trial" :
                (DateTime.UtcNow - LicenseStart.Value).TotalDays <= LicenseDays ? "active" : "expired";

            [NotMapped]
            public int DaysRemaining =>
                LicenseStart == null ? LicenseDays :
                Math.Max(0, LicenseDays - (int)(DateTime.UtcNow - LicenseStart.Value).TotalDays);

        }
}
