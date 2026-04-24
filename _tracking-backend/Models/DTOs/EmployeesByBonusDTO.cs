// Archivo: Models/DTOs/EmployeesByBonusDTO.cs
using System;
using Azure.Core;

namespace MicroServicioTracking.Models.DTOs
{

    public class EmployeesByBonusDTO
    {
        public int Id { get; set; }
        public int IdBranch { get; set; }
        public int IdEmployee { get; set; }
        public int IdBonus { get; set; }
        public string? EmployeeName { get; set; }
        public DateTime IncidenceDate { get; set; }
        public bool? FromPayroll { get; set; }
        //public string Bonus { get; set; } 
        //public Decimal Quantity { get; set; }
        public bool Vigente { get; set; }
        public bool Valid { get; set; }
        public bool? Active { get; set; }
    }
}