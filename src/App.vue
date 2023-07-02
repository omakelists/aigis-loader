<script setup lang="ts">
import {ALAR, ALIG, ALText, ALTX, parseAL, ALContext, ALRD, ALTB} from './aigis-fuel/AL';

const props = defineProps(['lz4'])

const showImage = async (al: ALTX | ALIG, name: string) => {
  const d = document.getElementById('d');

  const binary = new Uint8ClampedArray(al.Image);
  if (!binary) return;
  if (binary.byteLength === 0) return;
  //
  const sp = document.createElement('span');
  sp.style.textAlign = 'left';
  const a = document.createElement('a');
  a.textContent = name;
  a.download = name.replace('.atx', '.png');
  sp.appendChild(a);
  d?.appendChild(sp);
  //
  const image = new ImageData(binary, al.Width, al.Height);
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  c.getContext('2d')?.putImageData(image, 0, 0);
  d?.appendChild(c);

  c.toBlob(blob => {
    if (blob) a.href = URL.createObjectURL(blob);
  });
};

const showText = async (text: string, name: string) => {
  const d = document.getElementById('d');
  //
  const sp = document.createElement('span');
  sp.style.textAlign = 'left';
  const a = document.createElement('a');
  a.textContent = name;
  a.download = name.replace('.atx', '.txt');
  a.href = URL.createObjectURL(new Blob([text], {
    type: "text/plain"
  }));
  sp.appendChild(a);
  d?.appendChild(sp);
  //
  const p = document.createElement('pre');
  p.style.textAlign = 'left';
  p.style.border = 'solid';
  p.textContent = text;
  d?.appendChild(p);
};

const showRecord = async (al: ALRD, name: string) => {
  const d = document.getElementById('d');
  //
  const sp = document.createElement('span');
  sp.style.textAlign = 'left';
  const a = document.createElement('a');
  a.textContent = name;
  // a.download = name.replace('.atx', '.txt');
  // a.href = URL.createObjectURL(new Blob([text], {
  //   type: "text/plain"
  // }));
  sp.appendChild(a);
  d?.appendChild(sp);
  //
  const tbl = document.createElement('table');
  tbl.style.border = 'solid';
  let index = 0;
  for (const header of al.Headers) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    td1.textContent = index.toString();
    tr.appendChild(td1);
    const td2 = document.createElement('td');
    td2.textContent = header.type.toString();
    tr.appendChild(td2);
    const td3 = document.createElement('td');
    td3.textContent = header.nameEN;
    tr.appendChild(td3);
    const td4 = document.createElement('td');
    td4.textContent = header.nameJP;
    tr.appendChild(td4);
    tbl.appendChild(tr);
  }
  d?.appendChild(tbl);
};

const showTable = async (al: ALTB, name: string) => {
  const d = document.getElementById('d');
  //
  const sp = document.createElement('span');
  sp.style.textAlign = 'left';
  const a = document.createElement('a');
  a.textContent = name;
  // a.download = name.replace('.atx', '.txt');
  // a.href = URL.createObjectURL(new Blob([text], {
  //   type: "text/plain"
  // }));
  sp.appendChild(a);
  d?.appendChild(sp);

  const sp2 = document.createElement('span');
  sp2.style.textAlign = 'left';
  sp2.textContent = `label: [${al.Label}]`;
  d?.appendChild(sp2);
  const sp3 = document.createElement('span');
  sp3.style.textAlign = 'left';
  sp3.textContent = `name: [${al.Name}]`;
  d?.appendChild(sp3);
  //
  const tbl = document.createElement('table');
  tbl.style.border = 'solid';
  let index = 0;

  const tr = document.createElement('tr');
  const idx = document.createElement('td');
  idx.textContent = '#';
  tr.appendChild(idx);
  for (const header of al.Headers) {
    const td = document.createElement('td');
    td.textContent = `[${header.type}]: ${header.nameEN} (${header.nameJP})`;
    tr.appendChild(td);
  }
  tbl.appendChild(tr);

  for (const content of al.Contents) {
    const tr = document.createElement('tr');
    const idx = document.createElement('td');
    idx.textContent = String(index++);
    tr.appendChild(idx);
    for (const header of al.Headers) {
      const td = document.createElement('td');
      td.textContent = String(content[header.nameEN]);
      tr.appendChild(td);
    }
    tbl.appendChild(tr);
  }
  d?.appendChild(tbl);
};

const onFilesInput = async (payload: Event) => {
  const { target } = payload;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.files) return;

  const context: ALContext = { lz4: props.lz4 };

  // search file
  for (const file of Array.from(target.files)) {
    console.log(`- ${file.name}`);
    // PNG
    if ((await file.slice(0, 4).text()) === '�PNG') {
      const d = document.getElementById('d');
      //
      const sp = document.createElement('span');
      sp.innerText = `◆png from ${file.name}`;
      sp.style.textAlign = 'left';
      d?.appendChild(sp);
      //
      const c = document.createElement('canvas');
      const bitmap = await createImageBitmap(file);
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext('2d')?.drawImage(bitmap, 0, 0);
      d?.appendChild(c);
      continue;
    }

    //
    const al = await parseAL(context, file);
    if (al instanceof ALAR) {
      for (const alFile of al.GetFiles(context)) {
        // if (!alFile.Name.includes("card") && !alFile.Name.includes("Harlem")) continue;
        // if (!alFile.Name.includes("card")) continue;
        // if (!alFile.Name.includes("Harlem")) continue;
        if (alFile.content instanceof ALTX)
          showImage(alFile.content, alFile.name);
        if (alFile.content instanceof ALIG)
          showImage(alFile.content, alFile.name);
        if (alFile.content instanceof ALText)
          showText(alFile.content.Text, alFile.name);
        if (alFile.content instanceof ALRD)
          showRecord(alFile.content, alFile.name);
        if (alFile.content instanceof ALTB)
          showTable(alFile.content, alFile.name);
      }
    }
    if (al instanceof ALTX) showImage(al, 'ALTX');
    if (al instanceof ALIG) showImage(al, 'ALTX');
    if (al instanceof ALRD) showRecord(al, 'ALRD');
    if (al instanceof ALTB) showTable(al, 'ALTB');
  }
};

const clear = async (_payload: Event) => {
  const d = document.getElementById('d');
  const files = document.getElementById('fileInput');
  const dirs = document.getElementById('dirInput');
  if (d) d.innerHTML = '';
  if (files) (files as HTMLInputElement).value = '';
  if (dirs) (dirs as HTMLInputElement).value = '';
};
</script>

<template>
  <h1>アイギスローダー</h1>
  <div class="controls">
    <button @click="clear">クリア</button>
    <label>
      <span>ファイル</span>
      <input type="file" multiple id="fileInput" @input="onFilesInput"
    /></label>
    <label>
      <span>フォルダ</span>
      <input type="file" webkitdirectory id="dirInput" @input="onFilesInput"
    /></label>
  </div>
  <div id="d" style="display: grid"></div>
</template>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}

.controls {
  padding: 10px;
  display: grid;
  column-gap: 1em;
  row-gap: 1em;
}
</style>
