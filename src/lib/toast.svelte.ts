class Toast {
  msg = $state('');
  #t: ReturnType<typeof setTimeout> | undefined;
  show(msg: string) {
    this.msg = msg;
    clearTimeout(this.#t);
    this.#t = setTimeout(() => (this.msg = ''), 1800);
  }
}
export const toast = new Toast();
