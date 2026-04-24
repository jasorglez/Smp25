using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Linq;
using System.Threading.Tasks;

namespace SMP.Models
{
    [Table("projects")]
    public class Project
    {
        [Key]
        [Column("id")]
        public int Id { get; set; }

        [Column("idConsecutivo", TypeName = "int")]
        public int? IdConsecutivo { get; set; }

        [Column("number", TypeName = "varchar(80)")]
        public string? Number { get; set; }

        [Column("id_contrato", TypeName = "int")]
        public int? IdContrato { get; set; }

        [Column("id_oilfield", TypeName = "int")]
        public int? IdOilfield { get; set; }

        [Column("id_active", TypeName = "int")]
        public int? IdActive { get; set; } = 0;

        [Column("name", TypeName = "nvarchar(150)")]
        public string? Name { get; set; }

        [Column("year", TypeName = "nvarchar(4)")]
        public string? Year { get; set; }

        [Column("diameter", TypeName = "nchar(10)")]
        public string? Diameter { get; set; }

        [Column("length", TypeName = "decimal(14, 2)")]
        [DefaultValue(0.0)]
        public decimal? Length { get; set; }

        [Column("description", TypeName = "text")]
        public string? Description { get; set; }

        [Column("priority", TypeName = "tinyint")]
        [DefaultValue(0)]
        public byte Priority { get; set; }

        [Column("budgetmanagement", TypeName = "nvarchar(2)")]
        [DefaultValue("NO")]
        public string? BudgetManagement { get; set; }

        [Column("linerigth", TypeName = "nvarchar(2)")]
        [DefaultValue("NO")]
        public string? LineRight { get; set; }

        [Column("government", TypeName = "varchar(2)")]
        [DefaultValue("NO")]
        public string? Government { get; set; }

        [Column("receivedenginnering", TypeName = "varchar(2)")]
        [DefaultValue("NO")]
        public string? ReceivedEngineering { get; set; }

        [Column("datedelivery", TypeName = "date")]
        public DateTime? DateDelivery { get; set; }

        [Column("supplypipe", TypeName = "nvarchar(2)")]
        [DefaultValue("NO")]
        public string? SupplyPipe { get; set; }

        [Column("request", TypeName = "nvarchar(20)")]
        public string? Request { get; set; }

        [Column("programstart", TypeName = "date")]
        public DateTime? ProgramStart { get; set; }

        [Column("programend", TypeName = "date")]
        public DateTime? ProgramEnd { get; set; }

        [Column("realpronosticLPO", TypeName = "date")]
        public DateTime? RealPronosticLPO { get; set; }

        [Column("realpronosticTTT", TypeName = "date")]
        public DateTime? RealPronosticTTT { get; set; }

        [Column("classification", TypeName = "varchar(15)")]
        [DefaultValue("Terrestre")]
        public string? Classification { get; set; }

        [Column("state", TypeName = "varchar(10)")]
        [DefaultValue("Ejecucion")]
        public string? State { get; set; }

        [Column("typeconstruction", TypeName = "varchar(20)")]
        [DefaultValue("DUCTO TERRESTRE")]
        public string? TypeConstruction { get; set; }

        [Column("comment", TypeName = "nvarchar(80)")]
        public string? Comment { get; set; }

        [Column("active")]
        public short Active { get; set; } = 1;
                
        [ForeignKey("IdOilfield")]
        public virtual Oilfield? NavOilfield { get; set; }

        [ForeignKey("IdContrato")]
        public virtual Contract? NavContract { get; set; }
    }
}