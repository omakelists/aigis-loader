<script setup lang="ts">
import {PropType} from "vue";
import {ALTB} from "../aigis-fuel/AL";

defineProps({
  name: String,
  data: Object as PropType<ALTB>,
});
</script>

<template>
  <div>
    <div><a>{{name}}</a></div>
    <div>{{`label: [${data?.Label}]`}}</div>
    <div>{{`name: [${data?.Name}]`}}</div>
    <table style="border: solid;">
      <tr>
        <th>#</th>
        <th v-for="(header, col) in data?.Headers" :key="col">{{`[${header.type}]: ${header.nameEN} (${header.nameJP})`}}</th>
      </tr>
      <tr v-for="(content, row) of data?.Contents" :key="row">
        <th>{{row}}</th>
        <td v-for="(header, col) in data?.Headers" :key="col">{{String(content[header.nameEN])}}</td>
      </tr>
    </table>
  </div>
</template>

<style scoped>

</style>