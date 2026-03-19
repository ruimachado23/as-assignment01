using System.Diagnostics;
using OpenTelemetry;

namespace Nop.Web.Infrastructure;

/// <summary>
/// Strips or masks PII-related span attributes before they leave the application process.
/// This is the single enforcement point for the privacy strategy.
/// </summary>
public class PiiSanitisationProcessor : BaseProcessor<Activity>
{
    private static readonly string[] PiiPatterns =
    [
        "email", "mail",
        "name", "firstname", "lastname",
        "phone", "fax",
        "address", "street", "city", "zip", "postal",
        "card", "cvv", "creditcard", "credit_card",
        "ip", "customer_ip",
        "vat", "vatnumber",
        "password", "secret", "token"
    ];

    public override void OnEnd(Activity activity)
    {
        if (activity == null)
            return;

        foreach (var tag in activity.TagObjects)
        {
            var key = tag.Key.ToLowerInvariant();

            foreach (var pattern in PiiPatterns)
            {
                if (key.Contains(pattern))
                {
                    activity.SetTag(tag.Key, "[REDACTED]");
                    break;
                }
            }
        }

        base.OnEnd(activity);
    }
}
