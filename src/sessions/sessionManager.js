/**
 * In-memory session store keyed by WhatsApp JID.
 *
 * Session shape:
 * {
 *   flowType:     'weigh' | 'van' | 'route' | 'edit',
 *   step:         'SELECT_PRODUCT' | 'SAMPLE_1' | 'SAMPLE_2' | 'SAMPLE_3' | 'SAMPLE_4' | 'QUANTITY',
 *   product:      { id, product_name, min_weight, max_weight },
 *   samples:      number[],
 *   average:      number,
 *   avgRounded:   number,
 *   status:       'Optimal' | 'Overweight' | 'Underweight',
 *   variance:     number,
 *   senderNumber: string,
 * }
 */
const sessions = new Map();

function getSession(jid) {
    return sessions.get(jid) || null;
}

function setSession(jid, data) {
    sessions.set(jid, data);
}

function updateSession(jid, data) {
    const existing = sessions.get(jid) || {};
    sessions.set(jid, { ...existing, ...data });
}

function clearSession(jid) {
    sessions.delete(jid);
}

function hasSession(jid) {
    return sessions.has(jid);
}

module.exports = { getSession, setSession, updateSession, clearSession, hasSession };
