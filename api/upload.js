export const config = { api: { bodyParser: false } };

import Busboy from 'busboy';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const bb   = Busboy({ headers: req.headers });
  let buffer = Buffer.alloc(0);
  let fname  = 'file.pdf';          // fallback
  let mime   = 'application/pdf';   // fallback

  bb.on('file', (_fld, file, filename, _enc, mimetype) => {
    if (filename) fname = filename;
    if (mimetype) mime  = mimetype;

    file.on('data', d => { buffer = Buffer.concat([buffer, d]); });
  });

  bb.on('finish', async () => {
    try {
      /* --- costruiamo il multipart “a mano” ------------------------- */
      const boundary = '----vercelBoundary' + Date.now();
      const head = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="data"; filename="${fname}"\r\n` +
        `Content-Type: ${mime}\r\n\r\n`
      , 'utf8');
      const tail = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const body = Buffer.concat([head, buffer, tail]);

      const gh = await fetch(
        'https://api.acquisizioneclienti.it/webhook/manual-ghl-subaccount-openai',
        {
          method : 'POST',
          headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
          body
        }
      );

      const txt = await gh.text();
      return res.status(gh.status).send(txt || 'OK');
    } catch (err) {
      console.error('Proxy error →', err);
      return res.status(500).send('Proxy error: ' + err.message);
    }
  });

  req.pipe(bb);
}
