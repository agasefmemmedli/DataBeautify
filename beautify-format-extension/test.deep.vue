<template>
<div class="container" v-if="loading">
<span class="spinner"></span>
</div>
<div v-else class="content">
<header>
<h1>{{ title }}</h1>
<nav>
<ul>
<li v-for="item in items" :key="item.id">
<a :href="item.link">{{ item.text }}</a>
</li>
</ul>
</nav>
</header>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
const props = defineProps<{
initialTitle: string;
}>();
const items = ref([{ id: 1, text: 'Home', link: '/' }]);
</script>

<style scoped lang="scss">
.container {
display: flex;
justify-content: center;
align-items: center;
height: 100vh;
}
</style>
