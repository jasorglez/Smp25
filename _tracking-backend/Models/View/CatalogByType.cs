using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace MicroServicioTracking.Models.View
{
    [Table("CatalogByType")]
    [Keyless]
    public class CatalogByType
    {
        public int Id { get; set; }
        public int IdCompany { get; set; }
        public string Description { get; set; }
        public string ValueAddition { get; set; }
        public string? ValueAddition2 { get; set; }
        public string Type { get; set; }
        public int ParentId { get; set; }
        public bool Vigente { get; set; }
        public bool Active { get; set; }
    }
}
