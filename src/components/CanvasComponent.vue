<script setup lang="ts">
import {onMounted, PropType, ref, watch} from "vue";

const props = defineProps({
  width: Number,
  height: Number,
  data: Object as PropType<ImageData | ImageBitmap>,
});

const canvasRef = ref<HTMLCanvasElement>();

onMounted(() => {
  drawData();
});

watch(() => props.data, () => {
  drawData();
});

function drawData() {
  const ctx = canvasRef?.value?.getContext('2d');
  if (ctx) {
    if (props.data instanceof ImageData) {
      ctx.putImageData(props.data, 0, 0);
    } else if (props.data instanceof ImageBitmap) {
      ctx.drawImage(props.data, 0, 0);
    }
  }
}

</script>

<template>
  <canvas ref="canvasRef" v-bind:width="width" v-bind:height="height"></canvas>
</template>

<style scoped>

</style>