using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace SMP.Models.DTO
{
    public class ProjectDto
    {
        public string CompanyNameShort { get; set; }
        public string OilfieldName { get; set; }
        public int? ProjectConsecutivoId { get; set; }
        public Contract Contract { get; set; }
    }
}