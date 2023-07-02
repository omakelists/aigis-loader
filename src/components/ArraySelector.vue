<script setup lang="ts" generic="T">
import {onMounted, ref, watch} from "vue";

const props = defineProps<{
  array: T[],
}>();
const emit = defineEmits<{
  update: [item: T],
}>();

const item = ref<T>();
const index = ref<number>();
const size = ref<number>();
const label = ref<string>();

watch([item, index, size], ([item, index, size]) => {
  label.value = `${item} [${(index||0)+1}/${size}]`;
});

watch(index, index => {
  item.value = props.array[index||0];
});

onMounted(() => {
  index.value = 0;
  size.value = props.array.length;
});

function previous() {
  const keys = props.array;
  if (item.value) {
    const i = keys.indexOf(item.value);
    if (i > 0) {
      index.value = i - 1;
      item.value = keys[i - 1];
    } else {
      index.value = keys.length - 1;
      item.value = keys[keys.length - 1];
    }
    emit('update', item.value);
  }
}

function next() {
  const keys = props.array;
  if (item.value) {
    const i = keys.indexOf(item.value);
    if (i + 1 < keys.length) {
      index.value = i + 1;
      item.value = keys[i + 1];
    } else {
      index.value = 0;
      item.value = keys[0];
    }
    emit('update', item.value);
  }
}

</script>

<template>
  <button @click="previous">-</button>
  <input v-model="label" style="text-align: center;" readonly>
  <button @click="next">+</button>
</template>

<style scoped>

</style>