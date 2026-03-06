/**
 * Shared bot socket reference.
 * Using a module-level ref ensures the scheduler always holds
 * the most recent live socket, even after reconnects.
 */
let _sock = null;

function getSocket() {
    return _sock;
}

function setSocket(sock) {
    _sock = sock;
}

module.exports = { getSocket, setSocket };
