// Archivo: Models/DTOs/EmployeesByPayrollDTO.cs
using System;
using Azure.Core;

namespace MicroServicioTracking.Models.DTOs
{
    public class EmployeesByPayrollDTO
    {
        public int Id { get; set; }
        public int Id_employee { get; set; }
        public int Id_normalpayroll { get; set; }
        public string EmployeeName { get; set; }
        public decimal PriceXHour { get; set; }
        public decimal WorkedHours { get; set; }
        public decimal ExtraWorkedHours { get; set; }
        public decimal SpecialWorkedHours { get; set; }
        public decimal BaseSalary { get; set; }
        public decimal ExtraSalary { get; set; }
        public decimal SpecialSalary { get; set; }
        public decimal GrossSalary { get; set; }
        public decimal Bonus { get; set; }
        public decimal PercentageDiscount { get; set; }
        public decimal realDiscount { get; set; }
        public decimal DigitalPayment { get; set; }
        public decimal Savings { get; set; }
        public decimal Absences { get; set; }
        public decimal Delays { get; set; }
        public string BancoNombre { get; set; }
        public int Banco { get; set; }
        public decimal Total { get; set; }
        public bool? Active { get; set; }
      
        
        // Puedes agregar aquí propiedades adicionales o propiedades calculadas
        // Por ejemplo:
        /*
        public string EmployeeName { get; set; }
        public decimal TotalSalary => BaseSalary + ExtraSalary + Bonus;
        */
    }
}
