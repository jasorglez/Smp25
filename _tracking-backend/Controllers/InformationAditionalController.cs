using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace MicroServicioTracking.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class InformationAditionalController : ControllerBase
    {
        private readonly IInformationAditionalService _informationAditionalService;

        public InformationAditionalController(IInformationAditionalService informationAditionalService)
        {
            _informationAditionalService = informationAditionalService;
        }

        [HttpGet("idInExp/{idInExp}")]
        public async Task<ActionResult<IEnumerable<InformationAditional>>> GetInformation(int idInExp)
        {
            var informationAditional = await _informationAditionalService.GetAll(idInExp);
            if (informationAditional == null || !informationAditional.Any())
            {
                return NotFound();
            }
            return Ok(informationAditional);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<InformationAditional>> GetById(int id)
        {
            var informationAditional = await _informationAditionalService.GetByIdAsync(id);
            if (informationAditional == null)
            {
                return NotFound();
            }
            return Ok(informationAditional);
        }

        [HttpPost]
        public async Task<ActionResult<InformationAditional>> Save(InformationAditional informationAditional)
        {
            await _informationAditionalService.SaveAsync(informationAditional);
            return CreatedAtAction(nameof(GetById), new { id = informationAditional.Id }, informationAditional);
        }

        [HttpPut("{idInExp}")]
        public async Task<ActionResult<InformationAditional>> Update(int idInExp, InformationAditional informationAditional)
        {
            var updatedInfo = await _informationAditionalService.UpdateAsync(idInExp, informationAditional);
            if (updatedInfo == null)
            {
                return NotFound();
            }
            return Ok(updatedInfo);
        }

        [HttpDelete("{idInExp}")]
        public async Task<ActionResult<bool>> Delete(int idInExp)
        {
            var result = await _informationAditionalService.DeleteAsync(idInExp);
            if (!result)
            {
                return NotFound();
            }
            return Ok(result);
        }
    }
}