<script>
  let count = 0;

function increment() {
    count += 1;
  }
</script>

<style>
  h1 {
color: #ff3e00;
  }
</style>

<main>
  <h1>Hello {name}!</h1>
  <button on:click={increment}>
    Clicks: {count}
  </button>

  {#if count > 10}
    <p>{count} is greater than 10</p>
  {:else if count < 5}
    <p>{count} is less than 5</p>
  {:else}
    <p>{count} is between 5 and 10</p>
  {/if}

  <ul>
    {#each items as item}
      <li>{item.name}</li>
    {/each}
  </ul>

  <div class:active={isActive} {...props} data-id="{id}">
    <span>Text with {expr} inside</span>
  </div>

  {@html htmlContent}
</main>
