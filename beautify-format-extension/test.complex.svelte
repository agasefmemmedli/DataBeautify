<script>
  export let name = 'world';
    let count = 0;
function increment() {
count += 1;
  }
</script>

<style>
  h1 {
color: purple;
    font-size: 2em;
  }
</style>

<main>
  <h1>Hello {name}!</h1>
  <p>Count: {count}</p>
<button on:click={increment}>Increment</button>
    {#if count > 5}
    <p>Count is high!</p>
    {:else}
      <p>Keep going...</p>
    {/if}
</main>
