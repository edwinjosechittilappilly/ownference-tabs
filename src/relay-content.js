(() => {
  if (window !== window.top || globalThis.__ownferenceRelayInstalled) return;
  globalThis.__ownferenceRelayInstalled = true;
  let channel, activePort;
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || !/^https?:$/.test(location.protocol) || event.data?.source !== 'ownference-page' || event.data?.type !== 'connect' || event.data?.version !== 1 || event.ports.length !== 1) return;
    if (channel) { channel.close(); activePort.disconnect(); }
    channel = event.ports[0];
    const current = channel;
    const port = chrome.runtime.connect({ name: 'ownference-relay-v1' });
    activePort = port;
    let ready = false;
    port.onMessage.addListener(message => {
      if (message.type === 'ready') ready = true;
      current.postMessage(message);
    });
    port.onDisconnect.addListener(() => {
      try { current.postMessage({ type: 'error', error: { code: 'relay_disconnected', message: 'Relay disconnected. Enable relay again and reconnect.' } }); current.close(); } catch { /* already closed */ }
      if (channel === current) channel = undefined;
    });
    current.onmessage = message => { if (message.data?.op === 'disconnect') { port.disconnect(); current.close(); if (channel === current) channel = undefined; } else if (ready) port.postMessage(message.data); };
    current.onmessageerror = () => port.disconnect();
    current.start();
  });
})();
