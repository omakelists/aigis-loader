<script setup lang="ts">
import {ALAR, ALIG, ALText, ALTX, parseAL, ALContext, ALRD, ALTB, AL} from './aigis-fuel/AL';
import {reactive} from "vue";

const props = defineProps(['lz4'])

type DataItem = {
  component: string,
  name: string,
  data: AL | ImageBitmap,
};
const alData = reactive<DataItem[]>([]);

const showImage = async (al: ALTX | ALIG, name: string) => {
  alData.push({
    component: 'ImageComponent',
    name: name,
    data: al,
  });
};

const showText = async (al: ALText, name: string) => {
  alData.push({
    component: 'TextComponent',
    name: name,
    data: al,
  });
};

const showRecord = async (al: ALRD, name: string) => {
  alData.push({
    component: 'RecordComponent',
    name: name,
    data: al,
  });
};

const showTable = async (al: ALTB, name: string) => {
  alData.push({
    component: 'TableComponent',
    name: name,
    data: al,
  });
};

const onFilesInput = async (payload: Event) => {
  const { target } = payload;
  if (!(target instanceof HTMLInputElement)) return;
  if (!target.files) return;

  const context: ALContext = { lz4: props.lz4 };

  // search file
  for (const file of Array.from(target.files)) {
    console.log(`Input file: ${file.name}`);
    // PNG
    if ((await file.slice(0, 4).text()) === '�PNG') {
      const bitmap = await createImageBitmap(file);
      alData.push({
        component: 'ImageComponent',
        name: file.name,
        data: bitmap,
      });
      continue;
    }

    //
    const al = await parseAL(context, file);
    if (al instanceof ALAR) {
      for (const alFile of al.Files) {
        // if (!alFile.Name.includes("card") && !alFile.Name.includes("Harlem")) continue;
        // if (!alFile.Name.includes("card")) continue;
        // if (!alFile.Name.includes("Harlem")) continue;
        if (alFile.content instanceof ALTX)
          showImage(alFile.content, alFile.name);
        if (alFile.content instanceof ALIG)
          showImage(alFile.content, alFile.name);
        if (alFile.content instanceof ALText)
          showText(alFile.content, alFile.name);
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
  const files = document.getElementById('fileInput');
  const dirs = document.getElementById('dirInput');
  if (files) (files as HTMLInputElement).value = '';
  if (dirs) (dirs as HTMLInputElement).value = '';
  alData.splice(0);
};
</script>
<script lang="ts">
import ImageComponent from "./components/ImageComponent.vue";
import TextComponent from "./components/TextComponent.vue";
import RecordComponent from "./components/RecordComponent.vue";
import TableComponent from "./components/TableComponent.vue";

export default {
  components: {
    ImageComponent,
    TextComponent,
    RecordComponent,
    TableComponent,
  },
}
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
  <div id="d" style="text-align: left;">
    <component
        v-for="(al, index) in alData"
        :key="index"
        :is="al.component"
        :name="al.name"
        :data="al.data"
    />
  </div>
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
