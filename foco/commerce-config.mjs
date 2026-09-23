// Public seller details only: no RUT documents, bank accounts or private credentials.
// Commercial terms approved by the owner on 2026-09-21. Unconfirmed facts stay empty.
export const FOCO_COMMERCE = Object.freeze({
    termsVersion: '2026-09-22.2',
    privacyVersion: '2026-09-22.2',
    termsUrl: '/foco/compra/',
    privacyUrl: '/foco/compra/privacidad/',
    seller: Object.freeze({ name: 'Juan Felipe Gaviria Campo', nit: '1001368555', noticeAddress: 'Transversal 1 Este #68-50, Bogotá D.C., Colombia', returnsAddress: 'Transversal 1 Este #68-50, Bogotá D.C., Colombia' }),
    product: Object.freeze({ material: 'PVC', dimensions: '86 × 54 mm' }),
    dispatchCity: 'Bogotá D.C.',
    carrier: '',
    availableCards: 30,
    pauseAt: 5,
    // Set only after verifying the merchant's billing treatment and Wompi evidence.
    billingConfirmed: true, // Owner confirmed no added IVA; receipt is not a DIAN invoice.
    consentEvidenceVerified: true, // Hosted Wompi/Blobs/Resend sandbox verified before approved launch.
});

// A manual inventory snapshot, not a reservation system. Operators must also pause
// the Wompi links at the threshold and reconcile pending payments before reopening.
export function stockAvailable(commerce = FOCO_COMMERCE) {
    return Number.isInteger(commerce.availableCards) && commerce.availableCards > commerce.pauseAt;
}

export function commerceReady(commerce = FOCO_COMMERCE) {
    const fields = [commerce.seller.name, commerce.seller.nit, commerce.seller.noticeAddress,
        commerce.seller.returnsAddress, commerce.dispatchCity,
        commerce.product.material, commerce.product.dimensions];
    return fields.every(value => typeof value === 'string' && value.trim().length > 0) &&
        stockAvailable(commerce) && commerce.billingConfirmed === true &&
        commerce.consentEvidenceVerified === true;
}
