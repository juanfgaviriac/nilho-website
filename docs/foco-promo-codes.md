# Checkout code discount

The open promotion gives COP 15,000 off an order when the customer applies any
code containing at least five letters. No issued-code list or external coupon
service is used. Leading/trailing whitespace is removed, accented letters are
supported, and codes are normalized to uppercase. Input is bounded to 64
characters and rejects control/invisible formatting characters.

The discount applies once per order, on top of the existing pack discount.
Shipping is unchanged. Current totals with a code are COP 95,000 / 185,000 /
235,000 for one / two / three cards. Without a code, existing prices remain.
There is no expiration or redemption cap for this rule.

The cart reveals the field under “¿Tienes un código?” and confirms with
“Descuento aplicado”. It does not claim the entered code matched a previously
issued promotion. A typed code is also checked before payment if the customer
skips the Apply button; invalid input prevents payment until corrected or cleared.

`getCheckoutOffer` is shared for display and server pricing. The server never
trusts a client amount or discount. Orders freeze `promoCode` and `promoDiscount`
separately from the pack discount. Changing/removing a code requires a new
checkout attempt ID; reusing an attempt with different promotion terms is rejected.
The browser checks the returned amount and code before redirecting to Wompi;
a stale or mismatched response cannot silently charge a different total.
Receipts and merchant notifications use the saved order breakdown, including for
retries. Historical orders without promo fields remain supported.

Automated commerce tests mock Wompi, email and storage. They verify fixed link
amounts, approved-payment handling, duplicate callback behavior and both email
payloads; they do not create real payments or prove external delivery.
