
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace SMP.Models
{
    [Table("contracts")]
    public class Contract
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        
        [Column("id", TypeName = "int")]
        public int Id { get; set; }

        [Column("id_branch")]
        public int IdBranch { get; set; }

        [Column("consecutive", TypeName = "int")]
        [DefaultValue(0)]
        public int? Consecutive { get; set; }

        [Column("speciality", TypeName = "nvarchar(50)")]
        public string? Speciality { get; set; }

        [Column("contract", TypeName = "varchar(20)")]
        [Required]
        [DefaultValue("CONTRACT")]
        public string? NumberContract { get; set; }

        [Column("description", TypeName = "text")]
        [Required]
        [DefaultValue("NOMBRE DE LA OBRA")]
        public string Description { get; set; }

        [Column("descripsmall", TypeName = "varchar(150)")]
        [Required]
        [DefaultValue("DESCRIPCION CORTA")]
        public string DescripSmall { get; set; }

        [Column("id_provider", TypeName = "int")]
        public int? IdProvider { get; set; }

        [Column("statecontract", TypeName = "varchar(40)")]
        [DefaultValue("EJECUCION")]
        public string? StateContract { get; set; }

        [Column("datestar", TypeName = "date")]
        public DateTime? DateStar { get; set; }

        [Column("dateend", TypeName = "date")]
        public DateTime? DateEnd { get; set; }

        [Column("term", TypeName = "int")]
        [Required]
        [DefaultValue(0)]
        public int? Term { get; set; }

        [Column("amountmx", TypeName = "decimal(12, 2)")]
        [Required]
        [DefaultValue(0.0)]
        public decimal? AmountMx { get; set; }

        [Column("amountdll", TypeName = "decimal(12, 2)")]
        [Required]
        [DefaultValue(0.0)]
        public decimal? AmountDll { get; set; }

        [Column("resident", TypeName = "varchar(150)")]
        public string? Resident { get; set; }

        [Column("supervisor", TypeName = "varchar(150)")]
        public string? Supervisor { get; set; }

        [Column("projects")]
        public int Project { get; set; }

        [Column("active")]
        public short Active { get; set; } = 1;

  //      [ForeignKey("IdProvider")]
  //      public virtual Provider? NavProviders { get; set; }
    }
}