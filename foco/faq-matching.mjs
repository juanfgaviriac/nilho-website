// Shared by browser and server. Only reviewed whole-question aliases qualify;
// never use substring/fuzzy matching for facts, negations or personal requests.
export const normalizeQuestion = value => value.normalize('NFD').replace(/\p{M}/gu, '')
    .toLowerCase().replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

export function findInstantAnswer(question, entries) {
    if (typeof question !== 'string' || question.length > 500) return null;
    const query = normalizeQuestion(question);
    const entry = entries.find(item => Array.isArray(item?.questions) && typeof item.answer === 'string' &&
        Array.isArray(item.sources) && item.questions.some(alias => typeof alias === 'string' && normalizeQuestion(alias) === query));
    return entry ? {answer:entry.answer, sources:entry.sources, mode:'instant'} : null;
}
