using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models.TD
{
    [Table("Otandlogbookxreportdiary")] // opcional, si quieres mapear a una vista o tabla
    public class otandlogbookxreport
    {
        [Column("idOt")]
        public int IdOt { get; set; }                 // o.Id

        [Column("ot_number")]
        public string OtNumber { get; set; }          // o.ot_number

        [Column("idProject")]
        public int IdProject { get; set; }         // o.description

        [Column("descripTD")]
        public string? DescripTD { get; set; }         // o.description

        [Column("cdc")]
        public string? Cdc { get; set; }               // o.cdc

        [Column("name")]
        public string? Name { get; set; }         // o.description

        [Column("neighborhood")]
        public string? Neighborhood { get; set; }
        
        [Column("address")]
        public string? Address { get; set; }

        [Column("descripconcepto")]
        public string? DescripConcepto { get; set; }   // w.description

        [Column("results")]
        public string? Results { get; set; }           // o.results

        [Column("quantity")]
        public decimal Quantity { get; set; }         // l.quantity

        [Column("register_date")]
        public DateTime RegisterDate { get; set; }    // o.register_date

        [Column("fechalogbook")]
        public DateTime FechaLogbook { get; set; }    // l.date

        [Column("area")]
        public string? Area { get; set; }              // o.area

        [Column("validado")]
        public string? Validado { get; set; }          // l.validado

        [Column("observations")]
        public string? Observations { get; set; }      // o.observations

        [Column("workprogramid")]
        public int WorkProgramId { get; set; }        // w.id

        [Column("idroot")]
        public int IdRoot { get; set; }               // r.id

        [Column("idLogbook")]
        public int IdLogbook { get; set; }               // l.id
        
        [Column("downloaded")]
        public bool? Downloaded { get; set; }           // o.downloaded

        [Column("classification")]
        public string? Classification { get; set; }      // o.observations
    }
}
