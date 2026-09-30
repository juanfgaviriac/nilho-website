// DANE DIVIPOLA MGN 2025: 32 departments plus Bogotá, Distrito Capital.
// https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/319
export const COLOMBIA_DEPARTMENTS = Object.freeze([
    'Bogotá, Distrito Capital',
    'Amazonas', 'Antioquia', 'Arauca',
    'Archipiélago de San Andrés, Providencia y Santa Catalina',
    'Atlántico', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare',
    'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
    'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño',
    'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'Santander',
    'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
]);

export function departmentField(value = '') {
    // Preserve Bogotá addresses entered before the field became a dropdown.
    const selected = ['Bogotá D.C.', 'Bogotá, D.C.', 'Bogotá Distrito Capital'].includes(value)
        ? COLOMBIA_DEPARTMENTS[0] : value;
    return `<div class="account-field"><label for="department">Departamento</label><select id="department" name="department" autocomplete="shipping address-level1" required><option value="" disabled ${!COLOMBIA_DEPARTMENTS.includes(selected) ? 'selected' : ''}>Selecciona</option>${COLOMBIA_DEPARTMENTS.map(name => `<option value="${name}" ${selected === name ? 'selected' : ''}>${name}</option>`).join('')}</select></div>`;
}
