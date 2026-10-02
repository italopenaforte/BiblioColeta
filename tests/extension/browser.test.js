import test from 'node:test';
import assert from 'node:assert/strict';
import { readSearchPage } from '../../extension/lib/browser.js';

const url = 'https://search.scielo.org/?q=teste';

function installChrome(failures) {
  let navigations = 0;
  globalThis.chrome = {
    tabs: {
      async update() { navigations += 1; },
      async get() { return { status: 'complete', url }; },
    },
    scripting: {
      async executeScript({ func }) {
        if (func.name === 'readSearchDom') {
          if (navigations <= failures) throw new Error('Página de resultados não reconhecida');
          return [{ result: { url, total: 0, records: [] } }];
        }
        return [{ result: { title: '502 Bad Gateway', text: '502 Bad Gateway' } }];
      },
    },
  };
  return () => navigations;
}

test('erro 502 é retentado e a página seguinte é lida', async () => {
  const navigations = installChrome(1);
  const result = await readSearchPage(1, url);
  assert.equal(result.total, 0);
  assert.equal(navigations(), 2);
});

test('três erros 502 interrompem a leitura com erro recuperável', async () => {
  const navigations = installChrome(3);
  await assert.rejects(readSearchPage(1, url), (error) => {
    assert.equal(error.code, 'transient');
    assert.equal(error.retryable, true);
    assert.match(error.message, /3 tentativas.*Retomar/);
    return true;
  });
  assert.equal(navigations(), 3);
});
