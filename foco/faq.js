import { findInstantAnswer } from './faq-matching.mjs';

const form = document.querySelector('[data-faq-form]');
if (form) {
    const input = form.elements.question;
    const send = form.querySelector('.faq-send');
    const cancel = form.querySelector('.faq-cancel');
    const status = form.querySelector('[data-faq-status]');
    const answer = form.querySelector('[data-faq-answer]');
    const text = form.querySelector('[data-faq-text]');
    const sources = form.querySelector('[data-faq-sources]');
    let instantAnswers = [];
    try {
        const data = JSON.parse(document.querySelector('[data-faq-instant]')?.textContent || '[]');
        if (Array.isArray(data)) instantAnswers = data;
    } catch { /* A stale or malformed bundle must not disable the API fallback. */ }
    let active;
    form.hidden = false;
    input.addEventListener('focus', () => { form.querySelector('#faq-notice').hidden = false; }, {once:true});
    const busy = value => {
        input.readOnly = value;
        send.hidden = value;
        cancel.hidden = !value;
        form.setAttribute('aria-busy', String(value));
    };
    const renderAnswer = data => {
        if (typeof data.answer !== 'string' || !Array.isArray(data.sources)) throw new Error('Invalid answer');
        text.textContent = data.answer.replace(/[←↑→↓↖↗↘↙]\uFE0F?/g, ' / ');
        sources.replaceChildren();
        for (const source of data.sources) {
            // Only same-site source links. Never render model HTML or Markdown.
            if (!/^\/(?:#faq|comprar\/|(?:soporte|compra|compra\/privacidad|privacidad|terminos)\/#[-a-z0-9]+)$/.test(source.url)) continue;
            const link = document.createElement('a');
            link.href = source.url;
            link.textContent = source.title;
            sources.append(link);
        }
        answer.hidden = false;
        status.textContent = '';
        answer.focus({preventScroll:true});
    };
    cancel.addEventListener('click', () => { active?.abort(); input.focus(); });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (active) return;
        const question = input.value.trim();
        if (question.length < 3) { status.textContent = 'Escribe una pregunta de al menos tres caracteres.'; input.focus(); return; }
        const instant = findInstantAnswer(question, instantAnswers);
        if (instant) { renderAnswer(instant); return; }
        const controller = new AbortController();
        active = controller;
        const timeout = setTimeout(() => controller.abort('timeout'), 25000);
        busy(true);
        answer.hidden = true;
        status.textContent = 'Consultando las guías de Foco…';
        try {
            const response = await fetch('/api/foco/faq', {
                method:'POST', headers:{'Content-Type':'application/json'},
                body:JSON.stringify({question}), signal:controller.signal,
            });
            if (!response.ok) {
                status.textContent = response.status === 429
                    ? 'Llegamos al límite de consultas. Inténtalo más tarde o habla con el equipo.'
                    : 'El asistente no está disponible ahora. Puedes consultar estas respuestas o hablar con el equipo.';
                return;
            }
            const data = await response.json();
            renderAnswer(data);
        } catch {
            status.textContent = controller.signal.aborted
                ? (controller.signal.reason === 'timeout' ? 'La respuesta tardó demasiado. Vuelve a intentarlo o habla con el equipo.' : 'Consulta cancelada.')
                : 'No pudimos obtener una respuesta. Revisa tu conexión o habla con el equipo.';
        } finally {
            clearTimeout(timeout);
            active = undefined;
            busy(false);
        }
    });
}
