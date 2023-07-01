<script setup lang="ts">
import {PropType} from "vue";
import {ALRD} from "../aigis-fuel/AL";

defineProps({
  name: String,
  data: Object as PropType<ALRD>,
});
</script>

<template>
  <div>
    <div><a>{{name}}</a></div>
    <table style="border: solid;">
      <tr>
        <th>#</th>
        <th>Type</th>
        <th>nameEN</th>
        <th>nameJP</th>
      </tr>
      <tr v-for="(header, index) in data?.Headers" :key="index">
        <th>{{index}}</th>
        <td>{{header.type}}</td>
        <td>{{header.nameEN}}</td>
        <td>{{header.nameJP}}</td>
      </tr>
    </table>
  </div>
</template>

<style scoped>

</style>