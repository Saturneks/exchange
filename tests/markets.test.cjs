const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');

const script = readFileSync('index.html', 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
const coins = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc' },
  { id: 'tether', name: 'Tether', symbol: 'usdt' },
  { id: 'usd-coin', name: 'USDC', symbol: 'usdc' },
];

function setup(fetch) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      style: {}, innerHTML: '', value: '',
      classList: { add() {}, remove() {} },
      focus() { this.focused = true; },
    });
    return elements.get(id);
  }
  const allButton = element('all-button');
  const context = vm.createContext({
    fetch, AbortSignal, setInterval() {},
    document: {
      getElementById: element,
      querySelectorAll: () => [allButton],
      querySelector: () => allButton,
    },
  });
  vm.runInContext(script.slice(0, script.indexOf('// ─── BOOT')), context);
  return { context, element, run: code => vm.runInContext(code, context) };
}
const ok = async () => ({ ok: true, json: async () => coins });

test('category and trimmed case-insensitive search compose in either order', async () => {
  const { run, element } = setup(ok);
  await run('loadMarkets()');
  run("filterMkt(document.querySelector('button'),'stablecoin')");
  element('mkt-search').value = '  BTC  ';
  run('filterSearch()');
  assert.match(element('mkt-body').innerHTML, /No coins match/);
  assert.doesNotMatch(element('mkt-body').innerHTML, /Bitcoin/);
  run("filterMkt(document.querySelector('button'),'all')");
  assert.match(element('mkt-body').innerHTML, /Bitcoin/);
  assert.doesNotMatch(element('mkt-body').innerHTML, /Tether/);
  element('mkt-search').value = 'usd';
  run("filterMkt(document.querySelector('button'),'stablecoin')");
  assert.match(element('mkt-body').innerHTML, /Tether/);
  assert.match(element('mkt-body').innerHTML, /USDC/);
  run('clearMarketFilters()');
  assert.equal(element('mkt-search').value, '');
  assert.equal(element('mkt-search').focused, true);
  assert.equal(run('mktFilter'), 'all');
  assert.match(element('mkt-body').innerHTML, /Bitcoin/);
});

for (const [name, failure] of Object.entries({
  network: async () => { throw new TypeError('Network failed'); },
  rateLimit: async () => ({ ok: false, json: async () => coins }),
  invalidData: async () => ({ ok: true, json: async () => ({ error: 'invalid' }) }),
  emptyData: async () => ({ ok: true, json: async () => [] }),
  timeout: async () => { throw new DOMException('Timed out', 'TimeoutError'); },
})) {
  test(`${name} offers retry, preserves pending filters, and recovers`, async () => {
    let attempts = 0;
    const { run, element } = setup(async (...args) => {
      attempts++;
      assert.equal(args[1].signal instanceof AbortSignal, true);
      return attempts === 1 ? failure() : ok();
    });
    await run('loadMarkets()');
    assert.equal(run('mktLoaded'), false);
    assert.match(element('mkt-loading').innerHTML, /Retry/);
    element('mkt-search').value = 'btc';
    run("filterMkt(document.querySelector('button'),'stablecoin'); filterSearch()");
    assert.match(element('mkt-loading').innerHTML, /Retry/);
    await run('loadMarkets()');
    assert.equal(run('mktLoaded'), true);
    assert.equal(element('mkt-loading').style.display, 'none');
    assert.match(element('mkt-body').innerHTML, /No coins match/);
  });
}

test('in-flight requests are deduplicated and apply the latest filters', async () => {
  let resolve;
  let calls = 0;
  const { run, element } = setup(() => {
    calls++;
    return new Promise(r => { resolve = r; });
  });
  const pending = run('loadMarkets()');
  await run('loadMarkets()');
  element('mkt-search').value = 'usdc';
  run("filterMkt(document.querySelector('button'),'stablecoin')");
  assert.equal(element('mkt-table').style.display, 'none');
  resolve(await ok());
  await pending;
  assert.equal(calls, 1);
  assert.match(element('mkt-body').innerHTML, /USDC/);
  assert.doesNotMatch(element('mkt-body').innerHTML, /Tether|Bitcoin/);
});
