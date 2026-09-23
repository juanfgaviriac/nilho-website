import { timingSafeEqual } from 'node:crypto';

export function authorizedReport(request, secret) {
    if (!secret || secret.length < 32 || request.method !== 'GET') return false;
    const provided = request.headers.get('authorization') || '';
    const expected = `Bearer ${secret}`;
    return Buffer.byteLength(provided) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
export const colombiaDay = value => new Date(new Date(value).getTime() - 5 * 3600000).toISOString().slice(0, 10);
export function reportWindow(days, now) {
    if (![7, 30, 90].includes(days)) throw new Error('Invalid report window.');
    const end = colombiaDay(now);
    const endStart = Date.parse(`${end}T00:00:00-05:00`);
    const startTime = endStart - (days - 1) * 86400000;
    return { start: colombiaDay(startTime), end, startTime, endTime: new Date(now).getTime(), days };
}
async function readMany(store, keys) {
    const output = [];
    for (let i = 0; i < keys.length; i += 20) {
        output.push(...await Promise.all(keys.slice(i, i + 20).map(async key => {
            const value = await store.get(key, { type: 'json' });
            if (!value) throw new Error('Ledger changed during report.');
            return [key.split('/')[1], value];
        })));
    }
    return new Map(output);
}
export async function commerceReport(store, days = 30, now = new Date()) {
    const window = reportWindow(days, now);
    const [orders, paid] = await Promise.all(['orders', 'paid'].map(async prefix => readMany(store, await store.listKeys(prefix))));
    const daily = Array.from({ length: days }, (_, i) => ({ day: colombiaDay(window.startTime + i * 86400000), revenue: 0, orders: 0 }));
    let revenue = 0, count = 0, cards = 0, shipping = 0, checkouts = 0, completedCheckouts = 0;
    for (const [id, order] of orders) {
        if (order.environment !== 'prod') throw new Error('Invalid ledger environment.');
        const created = Date.parse(order.createdAt);
        const record = paid.get(id);
        if (order.checkoutURL && created >= window.startTime && created <= window.endTime - 3600000) {
            checkouts++;
            if (record) completedCheckouts++;
        }
        if (!record) continue;
        const approved = Date.parse(record.approvedAt);
        if (!Number.isFinite(approved)) throw new Error('Invalid payment date.');
        if (approved < window.startTime || approved > window.endTime) continue;
        if (!Number.isSafeInteger(order.amountInCents) || order.amountInCents < 0 || order.currency !== 'COP' || ![1,2,3].includes(order.quantity)) throw new Error('Invalid payment amount.');
        const amount = order.amountInCents / 100;
        revenue += amount; count++; cards += order.quantity; shipping += order.offer.shipping;
        const day = daily.find(day => day.day === colombiaDay(approved));
        day.orders++; day.revenue += amount;
    }
    if ([...paid.keys()].some(id => !orders.has(id))) throw new Error('Payment missing its order.');
    return { status: 'ready', generatedAt: new Date(now).toISOString(), timezone: 'America/Bogota', currency: 'COP',
        start: window.start, end: window.end, revenue, orders: count, cards, shipping,
        checkouts, completedCheckouts, conversion: checkouts ? completedCheckouts / checkouts : null,
        daily, source: 'verified_wompi_ledger', refundsTracked: false };
}
