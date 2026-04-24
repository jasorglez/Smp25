using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Models.View
{
    [Table("EmployeesByBranchNameOrder")]
    public class EmployeesByBranchNameOrder
    {
        [Column("id")]
        public int Id { get; set; }

        [Column("id_branch")]
        public int? IdBranch { get; set; }

        [Column("branchname")]
        public string? BranchName { get; set; }

        [Column("id_depto")]
        public int? IdDepto { get; set; }

        [Required]
        [MaxLength(150)]
        public string Name { get; set; }

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
        [Precision(18, 4)]
        public decimal? Loan { get; set; }

        [Column("saving")]
        public decimal? Saving { get; set; }

        [MaxLength(250)]
        public string? Picture { get; set; } = "https://firebasestorage.googleapis.com/v0/b/beapp-501d1.appspot.com/o/images%2Favatar.png?alt=media&token=82764c78-2b0b-4b8a-b4ee-c6559897af0c";

        [MaxLength(10)]
        [Column("clock_password")]
        public string? ClockPassword { get; set; }

        [Column("pricexhour")]
        public decimal? PriceXHour { get; set; }

        [Column("basesalary")]
        [Precision(18, 4)]
        public decimal? BaseSalary { get; set; }

        [Column("basehours")]
        public decimal? BaseHours { get; set; }

        [Column("ingressdate")]
        public DateTime? IngressDate { get; set; }

        [Column("id_position")]
        public int? IdPosition { get; set; }

        [Column("id_bank")]
        public int? IdBank { get; set; }
        public bool? Vigente { get; set; } = true;
        public bool? Active { get; set; } = true;
    }
}