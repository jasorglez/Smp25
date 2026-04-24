using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models.View
{
    [Table("employeesxbranch")]
    public class Employeexbranch
    {

        public int IdRoot { get; set; }
        public string? Namecompany { get; set; }
        public int IdBranches { get; set; }
        public string? Namebranch { get; set; }
        public int Id { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("id_depto")]
        public int? IdDepto { get; set; }

        [Column("cedula")]
        public string? Cedula { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; }

        [Column("employee_code")]
        public string? EmployeeCode { get; set; }

        [MaxLength(200)]
        public string? Address { get; set; }

        [MaxLength(50)]
        public string? City { get; set; } = "CIUDAD";

        [MaxLength(5)]
        public string? Cp { get; set; }

        [MaxLength(35)]
        public string? State { get; set; }

        [MaxLength(35)]
        public string? Neighborhood { get; set; }

        [MaxLength(15)]
        public string? Phone { get; set; }

        [MaxLength(50)]
        [Required]
        public string Email { get; set; }

        public string? Rfc { get; set; }

        [Column("loan")]
        public decimal? Loan { get; set; }

        [Column("saving")]
        public decimal? Saving { get; set; }

        [MaxLength(250)]
        public string? Picture { get; set; }
        [MaxLength(10)]
        [Column("clock_password")]
        public string? ClockPassword { get; set; }

        [Column("pricexhour")]
        public decimal? PriceXHour { get; set; }

        [Column("basesalary")]
        public decimal? BaseSalary { get; set; }

        [Column("basehours")]
        public decimal? BaseHours { get; set; }

        [Column("ingressdate")]
        public DateTime? IngressDate { get; set; }

        [Column("id_position")]
        public int? IdPosition { get; set; }

        [Column("valueAdded")]
        public int? ValueAdded { get; set; }

        [Column("id_bank")]
        public int? IdBank { get; set; }
        public bool? Vigente { get; set; } = true;
        public bool? Active { get; set; } = true;
        public string? Type { get; set; }
    }
}

