<template>
  <div class="test">
    <h1 v-if="show">{{ title }}</h1>
    <button @click="toggle">Click me</button>
    <custom-component :prop-a="value" />
  <!-- missing </div> -->
</template>

<script setup>
import { ref } from 'vue'
const show = ref(true)
const title = ref('Hello Vue')
const value = ref('some value')
const toggle = () => { show.value = !show.value }
</script>

<style scoped>
.test {
  color: red;
  .nested {
    font-weight: bold;
  }
}
</style>
