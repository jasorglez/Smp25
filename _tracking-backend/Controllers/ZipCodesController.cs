using MicroServicioTracking.Models;
using MicroServicioTracking.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;

namespace MicroServicioTracking.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class ZipCodesController : ControllerBase
{
    private readonly IZipCodesService _zipCodesService;
    private readonly ILogger<ZipCodesController> _logger;

    public ZipCodesController(IZipCodesService zipCodesService, ILogger<ZipCodesController> logger)
    {
        _zipCodesService = zipCodesService;
        _logger = logger;
    }

    [HttpGet("{cp}")]
    public async Task<ActionResult> GetInfoByZipCode(string cp)
    {
        try
        {
            var result = await _zipCodesService.GetInfoByZipCode(cp);
            if (result == null || !result.Value.Any())
            {
                return NotFound(new { message = "No data found for the provided CP." });
            }

            var groupedResult = result.Value
                .GroupBy(z => new { z.Cp, z.Estado, z.Ciudad })
                .Select(g => new
                {
                    cp = g.Key.Cp,
                    estado = g.Key.Estado,
                    ciudad = g.Key.Ciudad,
                    asentamientos = g.Select(z => z.Asentamientos).ToList()
                })
                .ToList();

            return Ok(groupedResult);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error Retrieving Data By CP {Cp}", cp);
            return StatusCode(500, new { message = "An error occurred while processing your request." });
        }
    }
}