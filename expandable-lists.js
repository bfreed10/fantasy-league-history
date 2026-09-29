// Keep long data lists compact while leaving every row available.
(function () {
  const preview = 12;
  const states = new WeakMap();
  let nextId = 0;
  function scan() {
    const content = document.querySelector('#content');
    if (!content) return;
    content.querySelectorAll('table, ul, ol, .feature-list').forEach(list => {
      const items = list.tagName === 'TABLE'
        ? [...list.tBodies].flatMap(body => [...body.rows])
        : [...list.children];
      let state = states.get(list);
      if (!state && items.length <= preview) return;
      if (!state) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'expand-list-button';
        if (!list.id) list.id = `expandable-list-${++nextId}`;
        button.setAttribute('aria-controls', list.id);
        state = {button, expanded:false};
        states.set(list,state);
        button.addEventListener('click', () => {
          state.expanded = !state.expanded;
          scan();
        });
      }
      if (!state.button.isConnected) list.insertAdjacentElement('afterend',state.button);
      items.forEach((item,index) => {
        const hidden = !state.expanded && index >= preview;
        if (item.hidden !== hidden) item.hidden = hidden;
      });
      state.button.hidden = items.length <= preview;
      state.button.setAttribute('aria-expanded',String(state.expanded));
      const label = state.expanded ? `Show fewer (${preview} rows)` : `Show all ${items.length} rows`;
      if (state.button.textContent !== label) state.button.textContent = label;
    });
  }
  const content = document.querySelector('#content');
  if (!content) return;
  new MutationObserver(scan).observe(content,{childList:true,subtree:true});
  scan();
})();
