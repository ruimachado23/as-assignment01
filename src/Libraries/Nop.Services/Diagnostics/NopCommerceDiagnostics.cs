using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Nop.Services.Diagnostics;

/// <summary>
/// Shared ActivitySource and Meter for nopCommerce OpenTelemetry instrumentation
/// </summary>
public static class NopCommerceDiagnostics
{
    public const string ServiceName = "NopCommerce";

    public static readonly ActivitySource ActivitySource = new(ServiceName);
    public static readonly Meter Meter = new(ServiceName);

    // Metric: order processing duration (histogram, milliseconds)
    public static readonly Histogram<double> OrderProcessingDuration =
        Meter.CreateHistogram<double>(
            "nopcommerce.order.processing_duration",
            unit: "ms",
            description: "Time spent processing an order inside PlaceOrderAsync, excluding HTTP overhead");

    // Metric: inventory adjustment failures (counter)
    public static readonly Counter<long> InventoryAdjustmentFailures =
        Meter.CreateCounter<long>(
            "nopcommerce.inventory.adjustment_failures",
            description: "Number of failed inventory adjustments during order placement");

    // Metric: payment gateway latency (histogram, milliseconds)
    public static readonly Histogram<double> PaymentGatewayDuration =
        Meter.CreateHistogram<double>(
            "nopcommerce.payment.gateway_duration",
            unit: "ms",
            description: "Time spent in the payment gateway during ProcessPaymentAsync");
}
