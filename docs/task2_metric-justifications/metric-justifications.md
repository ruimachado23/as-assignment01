# Metric Justifications

## Order Processing Duration

`nopcommerce.order.processing_duration` (histogram, milliseconds)

This metric would tell an operator that the checkout pipeline is degrading before users start seeing errors.

ASP.NET Core already tracks HTTP request duration, but that number includes middleware, serialization, view rendering, and other overhead that has nothing to do with the actual order logic. This metric measures only the time spent inside `PlaceOrderAsync`, which is where validation, payment, persistence, and inventory adjustment happen.

If this metric's p95 starts climbing while HTTP latency stays flat, the operator immediately knows the problem is inside the order pipeline, not the web layer. That narrows the investigation to payment gateways, database contention, or inventory logic. Without this separation, a latency spike could mean anything.

Tags: `payment_method`, `status` (success/failure).

## Inventory Adjustment Failures

`nopcommerce.inventory.adjustment_failures` (counter)

This metric would tell an operator that customers are buying products that aren't actually available, before refund requests start piling up.

Under normal conditions this counter sits at zero. Any increment is immediately actionable: it means either the product catalog has stale availability data, or concurrent orders are racing on low-stock items. The `product_id` tag tells the engineer exactly which product to investigate and whether to disable it or restock.

This catches overselling at the moment it happens, not hours later when a customer opens a support ticket.

Tags: `product_id`, `reason` (out_of_stock / concurrency_error / unknown).

## Payment Gateway Latency

`nopcommerce.payment.gateway_duration` (histogram, milliseconds)

This metric would tell an operator whether a checkout slowdown is their problem or the payment provider's problem.

Payment is the only step in the order flow that calls an external system. It has fundamentally different failure modes: network timeouts, rate limiting, provider outages. If this histogram spikes alongside order processing duration, the root cause is the gateway. If only order processing duration spikes, the problem is internal. That distinction changes the entire incident response: you either escalate to the payment provider or you look at your own database and services.

Tags: `payment_method`, `status` (success/failure/timeout).
