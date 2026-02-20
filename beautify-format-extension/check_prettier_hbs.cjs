const prettier = require('prettier');

async function test() {
  const code = `
  {{#if condition}}
      <div>
            <span>Content</span>
      </div>
  {{/if}}
  `;
  try {
    const formatted = await prettier.format(code, {
      parser: 'glimmer',
      tabWidth: 2,
    });
    console.log('Formatted with glimmer:');
    console.log(formatted);
  } catch (e) {
    console.log('Error with glimmer:', e.message);
  }
}

test();
