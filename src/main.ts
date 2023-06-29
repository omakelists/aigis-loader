import { createApp } from 'vue';
import App from './App.vue';
import lz4init from "lz4-asm";

const wasm = await fetch('/lz4.wasm');
const wasmBuffer = await wasm.arrayBuffer();
const {lz4js} = await lz4init({ wasmBinary: wasmBuffer });

createApp(App, {lz4: lz4js}).mount('#app');
