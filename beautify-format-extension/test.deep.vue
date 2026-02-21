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
<main>
<slot name="default"></slot>
<CustomComponent :prop-a="valueA" @update="handleUpdate">
<template #header>
<h2>Section Title</h2>
</template>
<p>Some content here.</p>
</CustomComponent>
</main>
<footer>
<p>&copy; {{ year }} My Company</p>
</footer>
</div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import CustomComponent from './CustomComponent.vue';

const props = defineProps<{
initialTitle: string
}>();

const emit = defineEmits(['loaded']);

const loading = ref(true);
const title = ref(props.initialTitle);
const items = ref([
{ id: 1, text: 'Home', link: '/' },
{ id: 2, text: 'About', link: '/about' }
]);

const year = computed(() => new Date().getFullYear());

const handleUpdate = (val: string) => {
console.log('Updated:', val);
};

onMounted(() => {
setTimeout(() => {
loading.value = false;
emit('loaded');
}, 1000);
});
</script>

<style scoped lang="scss">
.container {
display: flex;
justify-content: center;
align-items: center;
height: 100vh;

.spinner {
width: 40px;
height: 40px;
border: 4px solid #f3f3f3;
border-top: 4px solid #3498db;
border-radius: 50%;
animation: spin 2s linear infinite;
}
}

.content {
max-width: 800px;
margin: 0 auto;
padding: 20px;

header {
margin-bottom: 20px;
nav ul {
list-style: none;
padding: 0;
li {
display: inline-block;
margin-right: 10px;
}
}
}
}

@keyframes spin {
0% { transform: rotate(0deg); }
100% { transform: rotate(360deg); }
}
</style>
