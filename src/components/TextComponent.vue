<script setup lang="ts">
import {PropType} from "vue";
import {ALText} from "../aigis-fuel/AL";

defineProps({
  name: String,
  data: Object as PropType<ALText>,
});
</script>

<template>
  <div>
    <span style="text-align: left;">
      <a ref="anchorRef" href="{{URL.createObjectURL(new Blob([data?.Text], { type: 'text/plain' }))}}" download="{{name.replace('.atx', '.txt')}}">{{name}}</a>
    </span>
    <pre ref="preRef" style="text-align: left; border: solid;">{{data?.Text}}</pre>
  </div>
</template>

<style scoped>

</style>