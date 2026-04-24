using System.ComponentModel.DataAnnotations.Schema;

namespace MicroServicioTracking.Models.View;

[Table("vw_conceptos_nivel4_base")]
public class ViewEgresos
{
    [Column("id")]
    public int Id { get; set; }

    [Column("dateexpend")]
    public DateTime DateExpend { get; set; }

    [Column("total")]
    public decimal Total { get; set; }

    [Column("id_businnes")]
    public int IdBusinnes { get; set; }

    [Column("id_account")]
    public int IdAccount { get; set; }

    [Column("CodigoNivel1")]
    public string CodigoNivel1 { get; set; }

    [Column("Nivel1")]
    public string Nivel1 { get; set; }

    [Column("CodigoNivel4")]
    public string CodigoNivel4 { get; set; }

    [Column("Nivel4")]
    public string Nivel4 { get; set; }
}