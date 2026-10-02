import { buildCsv, buildSearchReport } from './csv.js';
import { searchName } from './search-url.js';

function safeName(value) {
  return value.normalize('NFKC').replace(/[\\/:*?"<>|\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 70) || 'busca';
}

function fileBase(job) {
  const stamp = job.startedAt.replace(/[:.]/g, '-');
  return `BiblioColeta/${safeName(searchName(job.normalizedUrl))}-${stamp}`;
}

async function downloadText(text, mime, filename) {
  const objectUrl = URL.createObjectURL(new Blob([text], { type: mime }));
  try {
    const id = await chrome.downloads.download({
      url: objectUrl, filename, saveAs: true, conflictAction: 'uniquify',
    });
    await new Promise((resolve, reject) => {
      function changed(delta) {
        if (delta.id !== id || !delta.state) return;
        chrome.downloads.onChanged.removeListener(changed);
        if (delta.state.current === 'complete') resolve();
        else reject(new Error('O download foi cancelado ou interrompido.'));
      }
      chrome.downloads.onChanged.addListener(changed);
      chrome.downloads.search({ id }).then(([item]) => {
        if (item?.state === 'complete') { chrome.downloads.onChanged.removeListener(changed); resolve(); }
        if (item?.state === 'interrupted') { chrome.downloads.onChanged.removeListener(changed); reject(new Error('O download foi interrompido.')); }
      }).catch((error) => { chrome.downloads.onChanged.removeListener(changed); reject(error); });
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function downloadCsv(job, records) {
  const suffix = job.status === 'completed' ? '' : '-parcial';
  return downloadText(buildCsv(records), 'text/csv;charset=utf-8', `${fileBase(job)}/artigos${suffix}.csv`);
}

export function downloadReport(job) {
  const version = chrome.runtime.getManifest().version;
  const content = JSON.stringify(buildSearchReport(job, version), null, 2) + '\n';
  return downloadText(content, 'application/json;charset=utf-8', `${fileBase(job)}/busca.json`);
}
