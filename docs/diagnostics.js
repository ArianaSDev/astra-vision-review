// Temporary, memory-only observation. Never changes editor state or review exports.
export function createDiagnostics(output, snapshot) {
  const counts = Object.create(null), recent = [];
  let sequence = 0, lastRejection = null;
  function refresh() {
    try {
      const element = output();
      if (element) element.textContent = JSON.stringify({diagnostic:'D1',state:snapshot(),counts:{...counts},lastRejection,recent:[...recent]},null,2);
    } catch { /* Diagnostics must not interrupt the editor. */ }
  }
  function record(event, reason) {
    try {
      counts[event] = (counts[event] || 0) + 1;
      recent.push({sequence:++sequence,event,reason});
      if (event === 'draw-rejected') lastRejection = {...recent.at(-1)};
      if (recent.length > 12) recent.shift();
      refresh();
    } catch { /* Observation only; no recovery or mutation of editor state. */ }
  }
  return {record,refresh};
}
