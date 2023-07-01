<script setup lang="ts">
import {onMounted, PropType, ref, toRefs} from "vue";
import {ALIG, ALTX} from "../aigis-fuel/AL";

const props = defineProps({
  name: String,
  data: Object as PropType<ALTX | ALIG | ImageBitmap>,
})

const { data } = toRefs(props);

const anchorRef = ref<HTMLAnchorElement>();
const canvasRef = ref<HTMLCanvasElement>();

onMounted(() => {
  const canvas = canvasRef?.value;
  const ctx = canvasRef?.value?.getContext('2d');
  if (canvas && ctx && data?.value) {
    if (data.value instanceof ALTX || data.value instanceof ALIG) {
      const binary = new Uint8ClampedArray(data.value.Image);
      if (binary && binary.byteLength > 0) {
        canvas.width = data.value.Width;
        canvas.height = data.value.Height;
        ctx.putImageData(new ImageData(binary, data.value.Width, data.value.Height), 0, 0);
      }
    } else if (data.value instanceof ImageBitmap) {
      canvas.width = data.value.width;
      canvas.height = data.value.height;
      ctx.drawImage(data.value, 0, 0);
    }

    canvas?.toBlob(blob => {
      if (blob && anchorRef?.value)
        anchorRef.value.href = URL.createObjectURL(blob);
    });
  }
});
</script>

<template>
  <div>
    <div><a ref="anchorRef" download="{{name.replace('.atx', '.png')}}">{{name}}</a></div>
    <div><canvas ref="canvasRef" /></div>
  </div>
</template>

<style scoped>

</style>