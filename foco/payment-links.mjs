export const FOCO_WHATSAPP_URL = 'https://wa.me/573027738407';

export function transactionId(search) {
    const values = new URLSearchParams(search).getAll('id');
    return values.length === 1 && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(values[0]) ? values[0] : null;
}
