export const config = {  // <-- Vercel: disabilita il body-parser
  api: { bodyParser: false },
};

import Busboy from 'busboy';
import FormData from 'form-data';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const busboy = Busboy({ headers: req.headers });

  let fileBuffer = Buffer.alloc(0);
  let fileName   = 'file.pdf';
  let fileType   = 'application/pdf';

  // ❶ accumula il PDF
  busboy.on('file', (_field, file, filename, _enc, mimetype) => {
    if (filename)  fileName = filename;
    if (mimetype)  fileType = mimetype;

    file.on('data', (data) => { fileBuffer = Buffer.concat([fileBuffer, data]); });
  });

  // ❷ quando finisce lo stream, inoltra a n8n
  busboy.on('finish', async () => {
    try {
      const form = new FormData();
      form.append('data', fileBuffer, { filename: fileName, contentType: fileType });

      const gh = await fetch('https://api.acquisizioneclienti.it/webhook/manual-ghl-subaccount-openai', {
        method: 'POST',
        body:   form,
      });

      const txt = await gh.text();
      return res.status(gh.status).send(txt || 'OK');
    } catch (err) {
      console.error('Proxy error →', err);
      return res.status(500).send('Errore proxy: ' + err.message);
    }
  });

  req.pipe(busboy);   // avvia lo streaming
}
