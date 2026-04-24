using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models;

[Table("employeesxloans")]
public class EmployeesxLoans
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Column("id_employee")]
    public int IdEmployee { get; set; }

    [Column("date")]
    public DateTime? Date { get; set; }

    [Column("loan")]
    public decimal Loan { get; set; }

    [Column("payment")]
    public decimal Payment { get; set; }

    [Column("total")]
    public decimal? Total { get; set; }

    [Column("status")]
    [StringLength(10)]
    public string Status { get; set; } = "Pendiente"; // Valor por defecto

    [Column("type")]
    [StringLength(10)]
    public string Type { get; set; } = "Abono"; // Valor por defecto

    [Column("id_padre")]
    public int? IdPadre { get; set; } // Puede ser nulo

    [Column("comments")]
    [StringLength(100)]
    public string? Comments { get; set; } // Puede ser nulo

    [Column("active")]
    public bool Active { get; set; } = true; // Valor por defecto

    [Column("saldo")]
    public decimal Saldo { get; set; }
}