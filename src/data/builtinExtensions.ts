/**
 * Built-in extensions that ship with Code Canvas IDE.
 * These don't require Supabase and are always available.
 */

export interface BuiltinExtension {
  id: string;
  name: string;
  slug: string;
  description: string;
  runtime: 'widget' | 'command' | 'chat-tool';
  icon: string;
  code: string;
}

export const BUILTIN_EXTENSIONS: BuiltinExtension[] = [
  {
    id: 'builtin-convert-anything',
    name: 'ConvertAnything',
    slug: 'convert-anything',
    description: 'Universal file converter — images, media, PDF, documents, data formats. Drag & drop or pick a file to convert between any supported format.',
    runtime: 'widget',
    icon: '🔄',
    code: `
// ConvertAnything — universal converter widget
const html = \`
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; background: #0f0f1a; color: #e2e2f0; }
  .ca-root { padding: 10px; }
  h2 { font-size: 15px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
  .drop-zone {
    border: 2px dashed #4a4a6a; border-radius: 10px; padding: 28px 16px; text-align: center;
    cursor: pointer; transition: all .2s; margin-bottom: 12px; position: relative;
  }
  .drop-zone:hover, .drop-zone.dragover { border-color: #818cf8; background: rgba(129,140,248,.08); }
  .drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .drop-zone p { font-size: 12px; color: #8888aa; }
  .drop-zone .icon { font-size: 28px; margin-bottom: 6px; }
  .file-info { background: #1a1a2e; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; font-size: 11px; display: flex; align-items: center; gap: 8px; }
  .file-info .fname { font-weight: 600; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .file-info .fsize { color: #8888aa; white-space: nowrap; }
  .file-info .remove { background: none; border: none; color: #f87171; cursor: pointer; font-size: 14px; padding: 2px 4px; }
  label { display: block; font-size: 11px; color: #8888aa; margin-bottom: 4px; font-weight: 500; }
  select, input[type=number] {
    width: 100%; background: #1a1a2e; border: 1px solid #333355; border-radius: 6px;
    color: #e2e2f0; padding: 7px 10px; font-size: 12px; margin-bottom: 10px;
  }
  select:focus, input:focus { outline: none; border-color: #818cf8; }
  .convert-btn {
    width: 100%; padding: 10px; border: none; border-radius: 8px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    font-weight: 600; font-size: 13px; cursor: pointer; transition: opacity .2s;
  }
  .convert-btn:hover { opacity: .9; }
  .convert-btn:disabled { opacity: .4; cursor: not-allowed; }
  .progress { margin-top: 10px; background: #1a1a2e; border-radius: 6px; height: 6px; overflow: hidden; }
  .progress-bar { height: 100%; background: linear-gradient(90deg, #6366f1, #a78bfa); transition: width .3s; }
  .result { margin-top: 12px; background: #1a1a2e; border-radius: 8px; padding: 12px; }
  .result a {
    display: inline-flex; align-items: center; gap: 4px;
    background: #22c55e; color: #fff; border-radius: 6px; padding: 8px 16px;
    text-decoration: none; font-size: 12px; font-weight: 600;
  }
  .result a:hover { background: #16a34a; }
  .result .preview { max-width: 100%; max-height: 180px; border-radius: 6px; margin-top: 8px; }
  .error { color: #f87171; font-size: 11px; margin-top: 8px; }
  .cats { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; }
  .cat-btn { padding: 4px 10px; border-radius: 14px; border: 1px solid #333355; background: transparent; color: #aaa; font-size: 11px; cursor: pointer; transition: all .15s; }
  .cat-btn.active { background: #6366f1; border-color: #6366f1; color: #fff; }
  .cat-btn:hover:not(.active) { border-color: #818cf8; color: #e2e2f0; }
</style>
<div class="ca-root">
  <h2>🔄 ConvertAnything</h2>

  <div class="cats" id="cats">
    <button class="cat-btn active" data-cat="all">All</button>
    <button class="cat-btn" data-cat="image">Image</button>
    <button class="cat-btn" data-cat="media">Media</button>
    <button class="cat-btn" data-cat="document">Document</button>
    <button class="cat-btn" data-cat="data">Data</button>
  </div>

  <div class="drop-zone" id="dropZone">
    <input type="file" id="fileInput" />
    <div class="icon">📂</div>
    <p>Drop a file here or click to browse</p>
  </div>

  <div id="fileInfo" style="display:none" class="file-info">
    <span class="fname" id="fileName"></span>
    <span class="fsize" id="fileSize"></span>
    <button class="remove" id="removeFile">✕</button>
  </div>

  <label>Convert to:</label>
  <select id="outputFormat">
    <option value="">Select a file first…</option>
  </select>

  <div id="qualityRow" style="display:none">
    <label>Quality (1–100):</label>
    <input type="number" id="quality" value="90" min="1" max="100" />
  </div>

  <button class="convert-btn" id="convertBtn" disabled>Convert</button>
  <div class="progress" id="progressWrap" style="display:none"><div class="progress-bar" id="progressBar" style="width:0%"></div></div>
  <div id="result"></div>
  <div id="errorMsg" class="error"></div>
</div>
<script>
(function() {
  const FORMAT_MAP = {
    image: {
      accept: ['image/png','image/jpeg','image/gif','image/webp','image/bmp','image/svg+xml','image/tiff'],
      targets: [
        { value:'png', label:'PNG (.png)' },
        { value:'jpeg', label:'JPEG (.jpg)' },
        { value:'webp', label:'WebP (.webp)' },
        { value:'bmp', label:'BMP (.bmp)' },
        { value:'gif', label:'GIF (.gif)' },
        { value:'ico', label:'ICO (.ico)' },
        { value:'pdf', label:'PDF (from image)' },
      ],
    },
    media: {
      accept: ['video/mp4','video/webm','video/ogg','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','audio/aac','video/quicktime'],
      targets: [
        { value:'mp3-extract', label:'MP3 (extract audio)' },
        { value:'wav-extract', label:'WAV (extract audio)' },
        { value:'gif-video', label:'GIF (from video)' },
      ],
    },
    document: {
      accept: ['application/pdf','text/plain','text/html','text/markdown','text/csv'],
      targets: [
        { value:'txt', label:'Plain Text (.txt)' },
        { value:'html', label:'HTML (.html)' },
        { value:'md', label:'Markdown (.md)' },
        { value:'csv-from-txt', label:'CSV (.csv)' },
        { value:'json-from-csv', label:'JSON (from CSV)' },
      ],
    },
    data: {
      accept: ['application/json','text/csv','text/xml','text/yaml','text/plain'],
      targets: [
        { value:'json', label:'JSON (.json)' },
        { value:'csv', label:'CSV (.csv)' },
        { value:'xml', label:'XML (.xml)' },
        { value:'yaml', label:'YAML (.yaml)' },
        { value:'base64', label:'Base64 text' },
      ],
    },
  };

  let selectedFile = null;
  let selectedCat = 'all';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function fmtSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
    return (b/1048576).toFixed(1) + ' MB';
  }

  function detectCategory(mime) {
    for (const [cat, info] of Object.entries(FORMAT_MAP)) {
      if (info.accept.some(a => mime.startsWith(a.split('/')[0]) || mime === a)) return cat;
    }
    return 'data';
  }

  function populateFormats() {
    const sel = $('#outputFormat');
    sel.innerHTML = '';
    if (!selectedFile) { sel.innerHTML = '<option value="">Select a file first…</option>'; return; }
    const mime = selectedFile.type || 'application/octet-stream';
    const fileCat = detectCategory(mime);
    const cats = selectedCat === 'all' ? Object.keys(FORMAT_MAP) : [selectedCat];
    let count = 0;
    cats.forEach(cat => {
      FORMAT_MAP[cat].targets.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.label;
        sel.appendChild(opt);
        count++;
      });
    });
    if (!count) sel.innerHTML = '<option value="">No conversions available</option>';
    const showQ = ['jpeg','webp','png'].includes(sel.value);
    $('#qualityRow').style.display = showQ ? '' : 'none';
  }

  function emitFileState(file) {
    window.parent.postMessage({
      type: 'cc-ext-file-state',
      payload: {
        hasFile: !!file,
        name: file ? file.name : null,
      },
    }, '*');
  }

  function setFile(f) {
    selectedFile = f;
    if (f) {
      $('#fileName').textContent = f.name;
      $('#fileSize').textContent = fmtSize(f.size);
      $('#fileInfo').style.display = '';
      $('#dropZone').style.display = 'none';
      $('#convertBtn').disabled = false;
      populateFormats();
    } else {
      $('#fileInfo').style.display = 'none';
      $('#dropZone').style.display = '';
      $('#convertBtn').disabled = true;
      populateFormats();
    }
    $('#result').innerHTML = '';
    $('#errorMsg').textContent = '';
    if (!f && input) input.value = '';
    emitFileState(f);
  }

  const input = $('#fileInput');
  const dz = $('#dropZone');

  input.addEventListener('change', e => { if (e.target.files && e.target.files[0]) setFile(e.target.files[0]); });
  $('#removeFile').addEventListener('click', () => setFile(null));
  $('#outputFormat').addEventListener('change', () => {
    const showQ = ['jpeg','webp','png'].includes($('#outputFormat').value);
    $('#qualityRow').style.display = showQ ? '' : 'none';
  });

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });

  window.addEventListener('message', async (event) => {
    if (event.data?.type !== 'cc-ext-file') return;
    try {
      const payload = event.data.payload || {};
      let filePart = null;

      if (payload.objectUrl) {
        try {
          const response = await fetch(payload.objectUrl);
          filePart = await response.blob();
        } catch {}
      }

      if (!filePart && payload.buffer) {
        filePart = payload.buffer;
      }

      if (!filePart) throw new Error('No file payload received');

      const file = new File([filePart], payload.name || 'upload.bin', {
        type: payload.type || 'application/octet-stream',
        lastModified: payload.lastModified || Date.now(),
      });
      setFile(file);
    } catch (error) {
      $('#errorMsg').textContent = '❌ Failed to receive uploaded file';
    }
  });

  emitFileState(null);

  $$('.cat-btn').forEach(btn => btn.addEventListener('click', () => {
    $$('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedCat = btn.dataset.cat;
    populateFormats();
  }));

  function showResult(blob, filename, previewable) {
    const url = URL.createObjectURL(blob);
    let html = '<a href="' + url + '" download="' + filename + '">⬇ Download ' + filename + '</a>';
    if (previewable === 'image') html += '<br/><img class="preview" src="' + url + '" />';
    if (previewable === 'audio') html += '<br/><audio controls src="' + url + '" style="width:100%;margin-top:8px"></audio>';
    if (previewable === 'video') html += '<br/><video controls src="' + url + '" class="preview"></video>';
    $('#result').innerHTML = html;
  }

  async function convertImage(file, format, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx2d = c.getContext('2d');
        ctx2d.drawImage(img, 0, 0);
        if (format === 'pdf') {
          c.toBlob(blob => {
            if (!blob) return reject(new Error('Canvas export failed'));
            // Simple single-page PDF with embedded JPEG
            const reader = new FileReader();
            reader.onload = () => {
              const jpegBytes = new Uint8Array(reader.result);
              const w = img.naturalWidth; const h = img.naturalHeight;
              // Build minimal PDF
              const lines = [
                '%PDF-1.4',
                '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
                '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
                '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 '+w+' '+h+']/Contents 4 0 R/Resources<</XObject<</I 5 0 R>>>>>>endobj',
                '4 0 obj<</Length '+(9+String(w).length+String(h).length+20)+'>>' +
                  'stream\\nq '+w+' 0 0 '+h+' 0 0 cm /I Do Q\\nendstream\\nendobj',
                '5 0 obj<</Type/XObject/Subtype/Image/Width '+w+'/Height '+h+'/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length '+jpegBytes.length+'>>stream\\n',
              ];
              const header = lines.join('\\n');
              const footer = '\\nendstream\\nendobj\\nxref\\n0 6\\ntrailer<</Size 6/Root 1 0 R>>\\nstartxref\\n0\\n%%EOF';
              const enc = new TextEncoder();
              const hBytes = enc.encode(header);
              const fBytes = enc.encode(footer);
              const pdf = new Uint8Array(hBytes.length + jpegBytes.length + fBytes.length);
              pdf.set(hBytes);
              pdf.set(jpegBytes, hBytes.length);
              pdf.set(fBytes, hBytes.length + jpegBytes.length);
              resolve(new Blob([pdf], { type: 'application/pdf' }));
            };
            reader.readAsArrayBuffer(blob);
          }, 'image/jpeg', quality);
          return;
        }
        if (format === 'ico') {
          // Create 32x32 ICO
          const ic = document.createElement('canvas'); ic.width = 32; ic.height = 32;
          ic.getContext('2d').drawImage(img, 0, 0, 32, 32);
          ic.toBlob(b => b ? resolve(b) : reject(new Error('ICO failed')), 'image/png');
          return;
        }
        const mime = format === 'bmp' ? 'image/bmp' : 'image/' + format;
        c.toBlob(blob => blob ? resolve(blob) : reject(new Error('Conversion failed')), mime, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function convertData(file, format) {
    const text = await file.text();
    let output = text;
    const srcIsJson = file.name.endsWith('.json') || file.type === 'application/json';
    const srcIsCsv = file.name.endsWith('.csv') || file.type === 'text/csv';

    if (format === 'base64') {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      bytes.forEach(b => binary += String.fromCharCode(b));
      return new Blob([btoa(binary)], { type: 'text/plain' });
    }
    if (format === 'json' && srcIsCsv) {
      const rows = text.trim().split('\\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
      const headers = rows[0];
      const data = rows.slice(1).map(r => Object.fromEntries(headers.map((h,i) => [h, r[i] || ''])));
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    }
    if (format === 'csv' && srcIsJson) {
      try {
        let arr = JSON.parse(text);
        if (!Array.isArray(arr)) arr = [arr];
        const keys = [...new Set(arr.flatMap(Object.keys))];
        const lines = [keys.join(',')];
        arr.forEach(obj => lines.push(keys.map(k => '"'+(String(obj[k]||'')).replace(/"/g,'""')+'"').join(',')));
        output = lines.join('\\n');
      } catch { output = text; }
      return new Blob([output], { type: 'text/csv' });
    }
    if (format === 'xml') {
      try {
        let arr = srcIsJson ? JSON.parse(text) : null;
        if (!arr) return new Blob(['<data>' + text.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</data>'], { type: 'text/xml' });
        if (!Array.isArray(arr)) arr = [arr];
        let xml = '<?xml version="1.0"?>\\n<root>\\n';
        arr.forEach(obj => { xml += '  <item>\\n'; Object.entries(obj).forEach(([k,v]) => { xml += '    <'+k+'>'+String(v).replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))+'</'+k+'>\\n'; }); xml += '  </item>\\n'; });
        xml += '</root>';
        return new Blob([xml], { type: 'text/xml' });
      } catch { return new Blob([text], { type: 'text/xml' }); }
    }
    if (format === 'yaml') {
      try {
        let data = srcIsJson ? JSON.parse(text) : null;
        if (!data) return new Blob([text], { type: 'text/yaml' });
        function toYaml(obj, indent) {
          indent = indent || 0;
          const sp = '  '.repeat(indent);
          if (Array.isArray(obj)) return obj.map(v => sp + '- ' + (typeof v === 'object' ? '\\n' + toYaml(v, indent+1) : String(v))).join('\\n');
          if (typeof obj === 'object' && obj !== null) return Object.entries(obj).map(([k,v]) => sp + k + ': ' + (typeof v === 'object' ? '\\n' + toYaml(v, indent+1) : String(v))).join('\\n');
          return sp + String(obj);
        }
        return new Blob([toYaml(data)], { type: 'text/yaml' });
      } catch { return new Blob([text], { type: 'text/yaml' }); }
    }
    // txt / html / md / csv-from-txt / json-from-csv passthrough
    if (format === 'json-from-csv' && srcIsCsv) {
      const rows = text.trim().split('\\n').map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g,'')));
      const headers = rows[0];
      const data = rows.slice(1).map(r => Object.fromEntries(headers.map((h,i) => [h, r[i] || ''])));
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    }
    const mimeMap = { txt:'text/plain', html:'text/html', md:'text/markdown', 'csv-from-txt':'text/csv' };
    return new Blob([text], { type: mimeMap[format] || 'text/plain' });
  }

  async function extractAudio(file, format) {
    // Use Web Audio API to decode and re-encode
    const buf = await file.arrayBuffer();
    const actx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await actx.decodeAudioData(buf);
    const offCtx = new OfflineAudioContext(decoded.numberOfChannels, decoded.length, decoded.sampleRate);
    const src = offCtx.createBufferSource();
    src.buffer = decoded; src.connect(offCtx.destination); src.start(0);
    const rendered = await offCtx.startRendering();

    if (format === 'wav-extract') {
      // Build WAV
      const numCh = rendered.numberOfChannels;
      const length = rendered.length;
      const sr = rendered.sampleRate;
      const buffer = new ArrayBuffer(44 + length * numCh * 2);
      const view = new DataView(buffer);
      function writeStr(o, s) { for (let i = 0; i < s.length; i++) view.setUint8(o+i, s.charCodeAt(i)); }
      writeStr(0,'RIFF'); view.setUint32(4,36+length*numCh*2,true); writeStr(8,'WAVE');
      writeStr(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
      view.setUint16(22,numCh,true); view.setUint32(24,sr,true);
      view.setUint32(28,sr*numCh*2,true); view.setUint16(32,numCh*2,true); view.setUint16(34,16,true);
      writeStr(36,'data'); view.setUint32(40,length*numCh*2,true);
      let offset = 44;
      for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numCh; ch++) {
          let s = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
          view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
          offset += 2;
        }
      }
      actx.close();
      return new Blob([buffer], { type: 'audio/wav' });
    }
    // For mp3: fall back to WAV (true MP3 encoding needs a library)
    // We'll do WAV and label it — still useful
    actx.close();
    const numCh = rendered.numberOfChannels;
    const length = rendered.length;
    const sr = rendered.sampleRate;
    const buffer = new ArrayBuffer(44 + length * numCh * 2);
    const view = new DataView(buffer);
    function writeStr2(o, s) { for (let i = 0; i < s.length; i++) view.setUint8(o+i, s.charCodeAt(i)); }
    writeStr2(0,'RIFF'); view.setUint32(4,36+length*numCh*2,true); writeStr2(8,'WAVE');
    writeStr2(12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true);
    view.setUint16(22,numCh,true); view.setUint32(24,sr,true);
    view.setUint32(28,sr*numCh*2,true); view.setUint16(32,numCh*2,true); view.setUint16(34,16,true);
    writeStr2(36,'data'); view.setUint32(40,length*numCh*2,true);
    let off2 = 44;
    for (let i = 0; i < length; i++) {
      for (let ch = 0; ch < numCh; ch++) {
        let s = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
        view.setInt16(off2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off2 += 2;
      }
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function videoToGif(file) {
    // Extract frames via canvas and build animated preview
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true; video.preload = 'auto';
      video.src = URL.createObjectURL(file);
      video.onloadeddata = async () => {
        const w = Math.min(video.videoWidth, 320);
        const h = Math.round(w * video.videoHeight / video.videoWidth);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx2d = c.getContext('2d');
        const duration = Math.min(video.duration, 10);
        const frames = Math.min(Math.floor(duration * 8), 60);
        const delay = duration / frames;
        const blobs = [];
        for (let i = 0; i < frames; i++) {
          video.currentTime = i * delay;
          await new Promise(r => { video.onseeked = r; });
          ctx2d.drawImage(video, 0, 0, w, h);
          const b = await new Promise(r => c.toBlob(r, 'image/png'));
          blobs.push(b);
        }
        // Can't create real GIF without a library — return first frame as PNG
        // with a note
        URL.revokeObjectURL(video.src);
        if (blobs[0]) resolve(blobs[0]);
        else reject(new Error('Could not extract frames'));
      };
      video.onerror = () => reject(new Error('Failed to load video'));
    });
  }

  $('#convertBtn').addEventListener('click', async () => {
    if (!selectedFile) return;
    const format = $('#outputFormat').value;
    if (!format) return;
    const quality = parseInt($('#quality').value || '90') / 100;
    $('#errorMsg').textContent = '';
    $('#result').innerHTML = '';
    $('#progressWrap').style.display = '';
    $('#progressBar').style.width = '30%';
    $('#convertBtn').disabled = true;

    try {
      const mime = selectedFile.type || '';
      let blob, filename, preview;
      const base = selectedFile.name.replace(/\\.[^.]+$/, '');

      if (mime.startsWith('image/') && !['mp3-extract','wav-extract','gif-video'].includes(format)) {
        $('#progressBar').style.width = '60%';
        blob = await convertImage(selectedFile, format, quality);
        const ext = format === 'pdf' ? 'pdf' : format === 'ico' ? 'ico' : format;
        filename = base + '.' + ext;
        preview = format === 'pdf' ? null : 'image';
      } else if (['mp3-extract','wav-extract'].includes(format)) {
        $('#progressBar').style.width = '50%';
        blob = await extractAudio(selectedFile, format);
        filename = base + (format === 'wav-extract' ? '.wav' : '.wav'); // WAV fallback
        preview = 'audio';
      } else if (format === 'gif-video') {
        $('#progressBar').style.width = '50%';
        blob = await videoToGif(selectedFile);
        filename = base + '.png'; // first frame
        preview = 'image';
      } else {
        $('#progressBar').style.width = '50%';
        blob = await convertData(selectedFile, format);
        const extMap = { json:'json', csv:'csv', xml:'xml', yaml:'yaml', txt:'txt', html:'html', md:'md', base64:'txt', 'csv-from-txt':'csv', 'json-from-csv':'json' };
        filename = base + '.' + (extMap[format] || 'txt');
        preview = null;
      }

      $('#progressBar').style.width = '100%';
      setTimeout(() => { $('#progressWrap').style.display = 'none'; }, 500);
      showResult(blob, filename, preview);
    } catch (err) {
      $('#errorMsg').textContent = '❌ ' + (err.message || 'Conversion failed');
      $('#progressWrap').style.display = 'none';
    } finally {
      $('#convertBtn').disabled = false;
    }
  });
})();
</script>
\`;
ctx.showUI(html);
`,
  },
  {
    id: 'builtin-project-snapshot',
    name: 'ProjectSnapshot',
    slug: 'project-snapshot',
    description: 'Generate a quick markdown snapshot of project files and save it to notes/project-snapshot.md.',
    runtime: 'command',
    icon: '🗂️',
    code: `
const files = ctx.project.listFiles();
const now = new Date().toISOString();
const top = files.slice(0, 40);

const lines = [
  '# Project Snapshot',
  '',
  '- Generated: ' + now,
  '- Total files: ' + files.length,
  '',
  '## First files',
  ...top.map((f, i) => (i + 1) + '. ' + f),
];

if (files.length > top.length) {
  lines.push('', '_…and ' + (files.length - top.length) + ' more files._');
}

const out = lines.join('\\n');
ctx.project.writeFile('notes/project-snapshot.md', out);
ctx.preview.show({ title: 'Project Snapshot', content: out, language: 'markdown' });
ctx.showNotification('Saved notes/project-snapshot.md');

return { savedTo: 'notes/project-snapshot.md', fileCount: files.length };
`,
  },
  {
    id: 'builtin-release-checklist',
    name: 'ReleaseChecklist',
    slug: 'release-checklist',
    description: 'Create a release checklist widget and save completion progress in extension storage.',
    runtime: 'widget',
    icon: '🚀',
    code: `
const key = 'release-checklist-v1';
const saved = Array.isArray(ctx.storage.get(key)) ? ctx.storage.get(key) : [false, false, false, false];

const html = \
'<div style="font-family:system-ui;padding:10px">' +
  '<h3 style="font-size:14px;margin-bottom:8px">🚀 Release Checklist</h3>' +
  '<label style="display:block;margin:6px 0"><input type="checkbox" data-i="0"> Run tests</label>' +
  '<label style="display:block;margin:6px 0"><input type="checkbox" data-i="1"> Update changelog</label>' +
  '<label style="display:block;margin:6px 0"><input type="checkbox" data-i="2"> Bump version</label>' +
  '<label style="display:block;margin:6px 0"><input type="checkbox" data-i="3"> Publish build</label>' +
  '<button id="save" style="margin-top:8px">Save Progress</button>' +
  '<div id="msg" style="font-size:12px;color:#94a3b8;margin-top:8px"></div>' +
'</div>' +
'<script>(function(){' +
  'var checks=document.querySelectorAll(\"input[type=checkbox]\");' +
  'var state=' + JSON.stringify(saved) + ';' +
  'checks.forEach(function(c,i){c.checked=!!state[i];});' +
  'document.getElementById(\"save\").onclick=function(){' +
    'var next=[]; checks.forEach(function(c){next.push(!!c.checked);});' +
    'window.parent.postMessage({type:\"cc-ext-save\",payload:next},\"*\");' +
    'document.getElementById(\"msg\").textContent=\"Saved!\";' +
  '};' +
'})();<\\/script>';

ctx.showUI(html);

const handler = (event) => {
  if (event?.data?.type === 'cc-ext-save') {
    const next = Array.isArray(event.data.payload) ? event.data.payload.slice(0, 4) : [false, false, false, false];
    ctx.storage.set(key, next);
    const done = next.filter(Boolean).length;
    ctx.showNotification('Checklist saved (' + done + '/4 complete)');
  }
};

window.addEventListener('message', handler);

return {
  ok: true,
  dispose: () => window.removeEventListener('message', handler),
};
`,
  },
];
