export default class Comms {

  #handlers = new Map();

  init() {
    game.socket.on('module.%config.id%', this._receiveSocket.bind(this));
  }

  async _receiveSocket({event, data}) {
    const queue = this.#handlers.get(event) ?? [];
    const newHandlers = await queue.reduce( async (remaining, curr) => {
      await curr.handler(...data);
      if (!curr.once) remaining.push(curr);
      return remaining;
    }, []);

    if (newHandlers.length > 0) this.#handlers.set(event, newHandlers);
    else this.#handlers.delete(event);
  }

  #addHandler(moduleEvent, handler, once) {
    const cb = {once, handler};
    if (this.#handlers.has(moduleEvent)) this.#handlers.get(moduleEvent).push(cb);
    else this.#handlers.set(moduleEvent, [cb]);
  }

  on(moduleEvent, handler) {
    this.#addHandler(moduleEvent, handler, false);
  }

  once(moduleEvent, handler) {
    this.#addHandler(moduleEvent, handler, true);
  }

  emit(moduleEvent, ...data) {
    const payload = {event: moduleEvent, data};
    game.socket.emit('module.%config.id%', payload);

    return this._receiveSocket(payload);
  }

}

