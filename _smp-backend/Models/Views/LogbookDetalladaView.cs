using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace SMP.Models.Views
{
    [Table("LogbookDetalladaView")]
    public class LogbookDetalladaView
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("id_reporte")]
        public int? Id_reporte { get; set; }

        [Column("idPosicion")]
        public int? IdPosicion { get; set; }

        [Column("id_project")]
        public int? Id_project { get; set; }

        [Column("id_ot")]
        public int? Id_ot { get; set; }

        [Column("cuadrilla")]
        public string? Cuadrilla { get; set; }

        [Column("nameCuadrilla")]
        public string? NameCuadrilla { get; set; }

        [Column("otNumber")]
        public string? OtNumber { get; set; }
        
        [Column("cdcNumber")]
        public string? CdcNumber { get; set; }

        [Column("image")]
        public string? Image { get; set; }

        [Column("description")]
        public string? Description { get; set; }

        [Column("typenote")]
        public string? Typenote { get; set; }

        [Column("date")]
        public DateTime? Date { get; set; }

        [Column("NombreEmpleado")]
        public string? NombreEmpleado { get; set; }

        [Column("NombreConcepto")]
        public string? NombreConcepto { get; set; }

        [Column("NombreMaterial")]
        public string? NombreMaterial { get; set; }

        [Column("NombreEquipo")]
        public string? NombreEquipo { get; set; }

        [Column("quantity")]
        public decimal? Quantity { get; set; }

        [Column("EstatusReporte")]
        public bool? EstatusReporte { get; set; }

        [Column("paid")]
        public bool? Paid { get; set; }

        [Column("validado", TypeName = "varchar(7)")]
        public string? Validado { get; set; }


    }
}