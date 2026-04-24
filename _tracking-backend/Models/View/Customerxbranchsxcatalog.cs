using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models.View
{
    [Table("customersxbranchsxcatalog")]
    public class Customerxbranchsxcatalog

    {
        public int Id { get; set; }
        public int Idca { get; set; }
        public string? description { get; set; }
        public string? TypeName { get; set; }
        public int? IdCompany { get; set; }
        public string? Namecompany { get; set; }
        public int? IdBranch { get; set; }
        public string? Name { get; set; }
        public string? Latitud { get; set; }
        public string? Longitud { get; set; }
        public int? Radio { get; set; }
        public string? Valueaddition { get; set; }
        public string? Cp { get; set; }
        public string? Namecontact { get; set; }
        public string? Company { get; set; }

    }
}
