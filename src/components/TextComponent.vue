<script setup lang="ts">
import {onMounted, PropType, ref, toRefs} from "vue";
import {ALText} from "../aigis-fuel/AL";

const props = defineProps({
  name: String,
  data: Object as PropType<ALText>,
});

const { name, data } = toRefs(props);

const anchorRef = ref<HTMLAnchorElement>();

onMounted(() => {
  if (anchorRef.value && name?.value && data?.value) {
    anchorRef.value.href = URL.createObjectURL(new Blob([data.value.Text], { type: 'text/plain' }));
    anchorRef.value.download = name.value.replace('.atx', '.txt');
  }
});

</script>

<template>
  <div>
    <span style="text-align: left;">
      <a ref="anchorRef">{{name}}</a>
    </span>
    <pre ref="preRef" style="text-align: left; border: solid;">{{data?.Text}}</pre>
  </div>
</template>

<style scoped>

</style>