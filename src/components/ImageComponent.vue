<script setup lang="ts">
import {onMounted, PropType, ref, toRefs, watch} from "vue";
import {ALIG, ALTX, AltxFrame} from "../aigis-fuel/AL";
import CanvasComponent from "./CanvasComponent.vue";
import DrumSelector from "./ArraySelector.vue";

const props = defineProps({
  name: String,
  data: Object as PropType<ALTX | ALIG | ImageBitmap>,
})

const { name, data } = toRefs(props);

const imageData = ref<ImageData | ImageBitmap>();

const spriteKey = ref<string>();

const frameName = ref<string>();
const frameTable = ref<AltxFrame[]>([]);

const anchorRef = ref<HTMLAnchorElement>();
const canvasRef = ref<HTMLCanvasElement>();

function cropImage(sprite: AltxFrame) {
  const ctx = canvasRef?.value?.getContext('2d');
  if (ctx) {
    return ctx.getImageData(sprite.X, sprite.Y, sprite.Width, sprite.Height);
  }
  return undefined;
}

function updateFrame() {
  if (data?.value instanceof ALTX && spriteKey.value) {
    const sprites = data.value.Sprites[spriteKey.value];
    frameName.value = sprites.name;
    frameTable.value = sprites;
  }
}

watch(spriteKey, () => {
  updateFrame();
});

watch(imageData, (newValue) => {
  const canvas = canvasRef?.value;
  const ctx = canvasRef?.value?.getContext('2d');
  if (canvas && ctx) {
    if (newValue instanceof ImageData) {
      canvas.width = newValue.width;
      canvas.height = newValue.height;
      ctx.putImageData(newValue, 0, 0);
    } else if (newValue instanceof ImageBitmap) {
      canvas.width = newValue.width;
      canvas.height = newValue.height;
      ctx.drawImage(newValue, 0, 0);
    }

    canvas?.toBlob(blob => {
      if (blob && anchorRef?.value)
        anchorRef.value.href = URL.createObjectURL(blob);
    });
    updateFrame();
  }
});

onMounted(() => {
  if (name?.value && anchorRef.value) {
    anchorRef.value.download = name.value.replace('.atx', '.png');
  }

  if (data?.value) {
    if (data.value instanceof ALTX || data.value instanceof ALIG) {
      const binary = new Uint8ClampedArray(data.value.Image);
      if (binary && binary.byteLength > 0) {
        imageData.value = new ImageData(binary, data.value.Width, data.value.Height);
      }
    } else if (data.value instanceof ImageBitmap) {
      imageData.value = data.value;
    }
  }

  if (data?.value && data.value instanceof ALTX) {
    const keys = Object.keys(data.value.Sprites);
    if (keys.length > 0) {
      spriteKey.value = keys[0];
      updateFrame();
    }
  }
});
</script>

<template>
  <div>
    <div><a ref="anchorRef">{{name}}</a></div>
    <div><canvas ref="canvasRef" /></div>
    <div v-if="data instanceof ALTX && Object.keys(data.Sprites).length >= 2">
      <div>
        <DrumSelector :array="Object.keys(data.Sprites)" @update="item => spriteKey = item" />
      </div>
      <span>Frame name: [{{frameName}}]</span>
      <div>
        <CanvasComponent
            v-for="(sprite, index) in frameTable"
            :key="index"
            v-bind:width="sprite.Width"
            v-bind:height="sprite.Height"
            v-bind:data="cropImage(sprite)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>