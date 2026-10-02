import { readSearchDom } from './search-parser.js';
import { readArticleDom } from './article-parser.js';
import { secureScieloUrl } from './merge-metadata.js';

const SEARCH_HOSTS = new Set(['search.scielo.org']);
const ARTICLE_HOSTS = new Set(['www.scielo.br', 'scielo.br']);
const RETRY_DELAYS = [1000, 3000];

function abortError() { return new DOMException('Coleta interrompida.', 'AbortError'); }

function checkSignal(signal) { if (signal?.aborted) throw abortError(); }

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const timer = setTimeout(done, ms);
    function done() { signal?.removeEventListener('abort', stopped); resolve(); }
    function stopped() { clearTimeout(timer); signal.removeEventListener('abort', stopped); reject(abortError()); }
    signal?.addEventListener('abort', stopped, { once: true });
  });
}

function allowedUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !hosts.has(url.hostname)) {
    throw new Error(`A página saiu dos domínios permitidos da SciELO: ${value}`);
  }
  return url;
}

function temporaryError(title, body) {
  const heading = `${title} ${body.slice(0, 160)}`;
  const match = heading.match(/\b(500|502|503|504)\b|bad gateway|gateway timeout|service unavailable|internal server error/i);
  if (!match) return null;
  const error = new Error(`A SciELO apresentou um erro temporário (${match[0]}).`);
  error.code = 'transient';
  error.retryable = true;
  return error;
}

async function readPageOnce(tabId, target, reader, hosts, signal) {
  allowedUrl(target, hosts);
  checkSignal(signal);
  await chrome.tabs.update(tabId, { url: target });
  const deadline = Date.now() + 60000;
  let lastError = 'Página ainda não carregada.';
  while (Date.now() < deadline) {
    checkSignal(signal);
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      allowedUrl(tab.url || '', hosts);
      try {
        const [execution] = await chrome.scripting.executeScript({ target: { tabId }, func: reader });
        if (execution?.result?.url) {
          allowedUrl(execution.result.url, hosts);
          return execution.result;
        }
      } catch (error) {
        lastError = error.message;
        const [diagnostic] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => ({ title: document.title, text: document.body?.innerText?.slice(0, 350) || '' }),
        });
        const title = diagnostic?.result?.title || '';
        const body = diagnostic?.result?.text || '';
        const summary = `${title} ${body}`;
        if (/establishing a secure connection|bunny.shield|verificando.{0,30}(navegador|conexão)|access denied|acesso negado/i.test(summary)) {
          const blocked = new Error('A SciELO exibiu uma verificação ou bloqueio de acesso. Abra a aba da SciELO para conferir.');
          blocked.code = 'blocked';
          throw blocked;
        }
        const transient = temporaryError(title, body);
        if (transient) throw transient;
      }
    }
    await delay(350, signal);
  }
  throw new Error(`A página da SciELO não ficou pronta: ${lastError}`);
}

async function readPage(tabId, target, reader, hosts, signal) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await readPageOnce(tabId, target, reader, hosts, signal);
    } catch (error) {
      if (error.code !== 'transient') throw error;
      if (attempt === RETRY_DELAYS.length) {
        error.message = `${error.message} Foram feitas ${attempt + 1} tentativas. Clique em Retomar para tentar novamente.`;
        throw error;
      }
      await delay(RETRY_DELAYS[attempt], signal);
    }
  }
}

export async function openWorkerTab() {
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
  return tab.id;
}

export function readSearchPage(tabId, url, signal) {
  return readPage(tabId, url, readSearchDom, SEARCH_HOSTS, signal);
}

export function readArticlePage(tabId, url, signal) {
  return readPage(tabId, secureScieloUrl(url), readArticleDom, ARTICLE_HOSTS, signal);
}

export async function closeWorkerTab(tabId) {
  try { await chrome.tabs.remove(tabId); } catch { /* The user may have closed it already. */ }
}
