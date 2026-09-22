// Server-only recipients and transport. Neither recipient nor message kind comes
// from the checkout browser or an unsigned payment-webhook field.
export const FOCO_MERCHANT_EMAIL = 'team@nilho.co';
const validEmail = value => typeof value === 'string' && value.length <= 254 && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value);

export async function sendPreparedEmail({ message, transactionId, kind, apiKey, from = 'Foco <team@getfoco.co>', fetchImpl = fetch }) {
    if (!['receipt', 'merchant'].includes(kind) || typeof transactionId !== 'string' ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(transactionId) || !validEmail(message?.to) ||
        typeof message.html !== 'string' || typeof message.text !== 'string' || typeof message.subject !== 'string') {
        throw new Error('Invalid stored email.');
    }
    if (kind === 'merchant' && message.to !== FOCO_MERCHANT_EMAIL) throw new Error('Unapproved merchant recipient.');
    if (typeof apiKey !== 'string' || !apiKey.startsWith('re_')) throw new Error('Resend is not configured.');
    if (!/^Foco <[A-Za-z0-9._+-]+@getfoco\.co>$/.test(from)) throw new Error('Unapproved sender.');
    const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json',
            'Idempotency-Key': `foco-${kind}-v1/${transactionId}` },
        body: JSON.stringify({ from, to: [message.to], reply_to: 'team@getfoco.co', subject: message.subject,
            html: message.html, text: message.text }),
    });
    // Provider errors can contain private customer details; never surface them.
    if (!response.ok) throw new Error(`Resend request failed (${response.status}).`);
    const result = await response.json();
    if (typeof result.id !== 'string' || !/^[A-Za-z0-9-]{1,120}$/.test(result.id)) throw new Error('Resend did not confirm acceptance.');
    return { emailId: result.id }; // Provider acceptance is not inbox delivery.
}
