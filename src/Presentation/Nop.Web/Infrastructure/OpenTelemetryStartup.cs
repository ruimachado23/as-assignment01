using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Nop.Core.Infrastructure;
using Nop.Services.Diagnostics;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace Nop.Web.Infrastructure;

/// <summary>
/// Registers OpenTelemetry tracing and metrics in the nopCommerce startup pipeline
/// </summary>
public partial class OpenTelemetryStartup : INopStartup
{
    public void ConfigureServices(IServiceCollection services, IConfiguration configuration)
    {
        var otlpEndpoint = configuration["OpenTelemetry:OtlpEndpoint"] ?? "http://localhost:4317";

        services.AddOpenTelemetry()
            .ConfigureResource(resource => resource.AddService(NopCommerceDiagnostics.ServiceName))
            .WithTracing(tracing =>
            {
                tracing
                    .AddAspNetCoreInstrumentation()
                    .AddSource(NopCommerceDiagnostics.ServiceName)
                    .AddProcessor<PiiSanitisationProcessor>()
                    .AddOtlpExporter(opts => opts.Endpoint = new Uri(otlpEndpoint));
            })
            .WithMetrics(metrics =>
            {
                metrics
                    .AddAspNetCoreInstrumentation()
                    .AddMeter(NopCommerceDiagnostics.ServiceName)
                    .AddPrometheusExporter();
            });
    }

    public void Configure(IApplicationBuilder application)
    {
        application.UseOpenTelemetryPrometheusScrapingEndpoint();
    }

    /// <summary>
    /// Run early so OTel is available to all other startups
    /// </summary>
    public int Order => -1;
}


