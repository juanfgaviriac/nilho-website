import test from 'node:test';
import assert from 'node:assert/strict';
import { COLOMBIA_DEPARTMENTS, departmentField } from '../foco/colombia-departments.mjs';

test('department dropdown puts Bogotá first, followed by all 32 unique departments in Spanish order', () => {
    assert.equal(COLOMBIA_DEPARTMENTS.length, 33);
    assert.equal(new Set(COLOMBIA_DEPARTMENTS).size, 33);
    assert.equal(COLOMBIA_DEPARTMENTS[0], 'Bogotá, Distrito Capital');
    const departments = COLOMBIA_DEPARTMENTS.slice(1);
    assert.deepEqual(departments, [...departments].sort((a, b) => a.localeCompare(b, 'es')));
    for (const name of ['Archipiélago de San Andrés, Providencia y Santa Catalina', 'Guainía', 'Guaviare', 'Vaupés', 'Vichada', 'Cundinamarca']) assert.ok(departments.includes(name));
});
test('native department field is required, labeled and supports shipping autofill without assuming an address', () => {
    const html = departmentField();
    assert.match(html, /label for="department"/);
    assert.match(html, /<select id="department" name="department" autocomplete="shipping address-level1" required>/);
    assert.match(html, /<option value="" disabled selected>Selecciona<\/option>/);
    assert.equal((html.match(/<option /g) || []).length, 34);
    assert.doesNotMatch(html, /<input/);
});
test('department field restores the selection and earlier Bogotá spellings without injecting arbitrary text', () => {
    assert.match(departmentField('Antioquia'), /value="Antioquia" selected/);
    for (const value of ['Bogotá D.C.', 'Bogotá, D.C.', 'Bogotá Distrito Capital', 'Bogotá, Distrito Capital']) {
        assert.match(departmentField(value), /value="Bogotá, Distrito Capital" selected/);
    }
    const unknown = departmentField('<img src=x onerror=alert(1)>');
    assert.doesNotMatch(unknown, /<img|onerror/);
    assert.match(unknown, /value="" disabled selected/);
});
