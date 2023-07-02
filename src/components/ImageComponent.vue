<script setup lang="ts">
import {onMounted, PropType, ref, toRefs, watch} from "vue";
import {ALIG, ALTX, AltxFrame} from "../aigis-fuel/AL";
import CanvasComponent from "./CanvasComponent.vue";

const props = defineProps({
  name: String,
  data: Object as PropType<ALTX | ALIG | ImageBitmap>,
})

const { name, data } = toRefs(props);

const imageData = ref<ImageData | ImageBitmap>();

const spriteKey = ref<string>();
const spriteIndex = ref<number>();
const spriteSize = ref<number>();
const spriteLabel = ref<string>();

const frameName = ref<string>();
const frameTable = ref<AltxFrame[]>([]);

const anchorRef = ref<HTMLAnchorElement>();
const canvasRef = ref<HTMLCanvasElement>();

watch([spriteKey, spriteIndex, spriteSize], ([spriteKey, spriteIndex, spriteSize]) => {
  spriteLabel.value = `${spriteKey} [${(spriteIndex||0)+1}/${spriteSize}]`;
});

function previous() {
  if (data?.value && data.value instanceof ALTX) {
    const keys = Object.keys(data.value.Sprites);
    if (spriteKey.value) {
      const index = keys.indexOf(spriteKey.value)
      if (index > 0) {
        spriteIndex.value = index - 1;
        spriteKey.value = keys[index - 1];
      } else {
        spriteIndex.value = keys.length - 1;
        spriteKey.value = keys[keys.length - 1];
      }
    }
  }
}

function next() {
  if (data?.value && data.value instanceof ALTX) {
    const keys = Object.keys(data.value.Sprites);
    if (spriteKey.value) {
      const index = keys.indexOf(spriteKey.value)
      if (index + 1 < keys.length) {
        spriteIndex.value = index + 1;
        spriteKey.value = keys[index + 1];
      } else {
        spriteIndex.value = 0;
        spriteKey.value = keys[0];
      }
    }
  }
}

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
    const keys = Object.keys(data.value.Sprites);
    spriteIndex.value = keys.indexOf(spriteKey.value);
    spriteSize.value = keys.length;
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
    if (!spriteKey.value && keys.length > 0) {
      spriteKey.value = keys[0];
    }
  }
});
</script>

<template>
  <div>
    <div><a ref="anchorRef">{{name}}</a></div>
    <div><canvas ref="canvasRef" /></div>
    <div v-if="data instanceof ALTX">
      <div>
        <button @click="previous">-</button>
        <input v-model="spriteLabel" style="text-align: center;" readonly>
        <button @click="next">+</button>
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