using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;

namespace MicroServicioTracking.Models
{
    [Table("conceptsxincorexp")]
    public class ConceptsxIncorExp
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }

        [Column("id_incorexp")]
        public int? IdIncorExp { get; set; }

        [Column("typeexpense")]
        [StringLength(15)]
        public string TypeExpense { get; set; }

        [Column("id_spend")]
        public int IdExpense { get; set; }

        [Column("id_cating")]
        public int? IdCatIng { get; set; }

        [Column("id_contribuyente")]
        public int IdContribuyente { get; set; }

        [Column("dateexpend")]
        public DateTime? DateExpend { get; set; }

        [Column("quantity")]
        public decimal Quantity { get; set; } = 0;

        [Column("description")]
        [StringLength(250)]
        public string? Description { get; set; }

        [Column("unit")]
        [StringLength(15)]
        public string? Unit { get; set; }

        [Column("price")]
        public decimal Price { get; set; } = 0;

        [Column("iva")]
        public bool Iva { get; set; } = false;

        [Column("iva2")]
        public Decimal Iva2 { get; set; } = 0;

        [Column("aplicaisr")]
        public bool AplicaIsr { get; set; } = false;

        [Column("isr")]
        public Decimal Isr { get; set; } = 0;

        // Campo calculado (solo lectura)
        [Column("total")]
        [DatabaseGenerated(DatabaseGeneratedOption.Computed)] // Indica que es un campo calculado
        public decimal Total => Quantity * Price; // Calcula el total en tiempo de ejecución

        [Column("comment")]
        [StringLength(50)]
        public string? Comment { get; set; }

        [Column("clave_prod_serv")]
        [StringLength(10)]
        public string? ClaveProdServ { get; set; }

        [Column("clave_unidad")]
        [StringLength(10)]
        public string? ClaveUnidad { get; set; }

        [Column("objeto_imp")]
        [StringLength(5)]
        public string? ObjetoImp { get; set; }

        [Column("numero_identificacion")]
        [StringLength(100)]
        public string? NumeroIdentificacion { get; set; }

        [Column("descuento")]        
        public decimal? Descuento { get; set; } = 0;



        [Column("active")]
        public bool Active { get; set; } = true;

    }
}
