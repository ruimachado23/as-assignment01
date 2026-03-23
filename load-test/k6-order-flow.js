import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------
const registrationSuccess = new Rate('registration_success');
const addToCartSuccess    = new Rate('add_to_cart_success');
const orderConfirmed      = new Rate('order_confirmed');
const orderDuration       = new Trend('order_e2e_duration', true);

// ---------------------------------------------------------------------------
// Load profile
// ---------------------------------------------------------------------------
export const options = {
  stages: [
    { duration: '30s',  target: 5  },   // warm-up
    { duration: '2m',   target: 5  },   // steady state
    { duration: '30s',  target: 15 },   // stress increase
    { duration: '1m',   target: 15 },   // peak load
    { duration: '30s',  target: 0  },   // cool-down
  ],
  thresholds: {
    http_req_duration:    ['p(95)<5000'],
    http_req_failed:      ['rate<0.15'],
    registration_success: ['rate>0.85'],
    order_confirmed:      ['rate>0.50'],   // ~15% simulated failures expected
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const BASE = 'http://localhost';

function extractToken(body) {
  const m = body.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/);
  return m ? m[1] : '';
}

function formPost(url, payload, params) {
  params = params || {};
  params.headers = Object.assign(
    { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' },
    params.headers || {},
  );
  return http.post(url, payload, params);
}

// ---------------------------------------------------------------------------
// Main scenario — full order flow per VU
// ~15% of orders will fail due to OTEL_SIMULATED_FAILURE_RATE on the server
// ---------------------------------------------------------------------------
export default function () {
  const email    = `k6_${__VU}_${__ITER}_${Date.now()}@loadtest.com`;
  const password = 'LoadTest123!';
  const start    = Date.now();
  let ordered    = false;

  // ── 1. Register ─────────────────────────────────────────────────────────
  group('Register', () => {
    const regPage = http.get(`${BASE}/register`);
    const token   = extractToken(regPage.body);

    const res = http.post(`${BASE}/register`, {
      FirstName:                      'LoadTest',
      LastName:                       'User',
      Email:                          email,
      Password:                       password,
      ConfirmPassword:                password,
      '__RequestVerificationToken':   token,
    });

    const ok = check(res, {
      'register status 200|302': (r) => r.status === 200 || r.status === 302,
      'register success':        (r) => r.body && r.body.includes('registerresult'),
    });
    registrationSuccess.add(ok);
    sleep(1);
  });

  // ── 2. Add Virtual Gift Card to cart ────────────────────────────────────
  group('Add to cart', () => {
    const prodPage = http.get(`${BASE}/25-virtual-gift-card`);
    const token    = extractToken(prodPage.body);

    const res = formPost(`${BASE}/addproducttocart/details/42/1`, {
      'giftcard_42.RecipientName':    'Recipient',
      'giftcard_42.RecipientEmail':   'recipient@loadtest.com',
      'giftcard_42.SenderName':       'LoadTest User',
      'giftcard_42.SenderEmail':      email,
      'addtocart_42.EnteredQuantity': '1',
      '__RequestVerificationToken':   token,
    });

    const ok = check(res, {
      'add-to-cart status 200': (r) => r.status === 200,
      'add-to-cart success':    (r) => {
        try { return JSON.parse(r.body).success === true; } catch (_) { return false; }
      },
    });
    addToCartSuccess.add(ok);
    sleep(1);
  });

  // ── 3. Checkout ─────────────────────────────────────────────────────────
  group('Checkout', () => {
    const coPage = http.get(`${BASE}/onepagecheckout`);
    const token  = extractToken(coPage.body);

    if (!token) {
      orderConfirmed.add(false);
      return;
    }

    // 3a. Save billing address
    formPost(`${BASE}/checkout/OpcSaveBilling`, {
      'BillingNewAddress.FirstName':       'LoadTest',
      'BillingNewAddress.LastName':         'User',
      'BillingNewAddress.Email':            email,
      'BillingNewAddress.CountryId':        '237',
      'BillingNewAddress.StateProvinceId':  '1828',
      'BillingNewAddress.City':             'New York',
      'BillingNewAddress.Address1':         '123 Load Test St',
      'BillingNewAddress.ZipPostalCode':    '10001',
      'BillingNewAddress.PhoneNumber':      '2125551234',
      'ShipToSameAddress':                  'false',
      '__RequestVerificationToken':         token,
    });
    sleep(0.5);

    // 3b. Save payment method
    formPost(`${BASE}/checkout/OpcSavePaymentMethod`, {
      'paymentmethod':                'Payments.CheckMoneyOrder',
      'UseRewardPoints':              'false',
      '__RequestVerificationToken':   token,
    });
    sleep(0.5);

    // 3c. Save payment info
    formPost(`${BASE}/checkout/OpcSavePaymentInfo`, {
      '__RequestVerificationToken': token,
    });
    sleep(0.5);

    // 3d. Confirm order
    const confirm = formPost(`${BASE}/checkout/OpcConfirmOrder`, {
      '__RequestVerificationToken': token,
    });

    const ok = check(confirm, {
      'confirm status 200': (r) => r.status === 200,
      'order placed':       (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === 1 || body.success === true || (body.redirect != null);
        } catch (_) {
          return false;
        }
      },
    });
    ordered = ok;
    orderConfirmed.add(ok);
  });

  if (ordered) {
    orderDuration.add(Date.now() - start);
  }

  sleep(2);
}
