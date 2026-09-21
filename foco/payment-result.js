import { FOCO_WHATSAPP_URL, transactionId } from './checkout-config.mjs';

const id = transactionId(window.location.search);
if (id) {
    document.querySelector('#transaction-id').textContent = id;
    document.querySelector('#result-reference').hidden = false;
    document.querySelector('#missing-reference').hidden = true;
}
const whatsapp = document.querySelector('#result-whatsapp');
whatsapp.href = FOCO_WHATSAPP_URL;
whatsapp.hidden = false;
// Never trust status/amount/order query parameters. No polling, automatic messages,
// local payment record or fulfilment: only the merchant's Wompi APPROVED state counts.
