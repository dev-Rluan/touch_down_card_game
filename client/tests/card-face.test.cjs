const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { test } = require('node:test');
const { build } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createDeck } = require('../../src/utils/CardUtils');

test('every server-deck card shows exactly its fruit count and one accessible description', async () => {
  const filename = path.resolve(__dirname, '../src/components/CardFace.jsx');
  const result = await build({ entryPoints: [filename], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['react'] });
  const component = new Module(filename);
  component.filename = filename;
  component.paths = Module._nodeModulePaths(path.dirname(filename));
  component._compile(result.outputFiles[0].text, filename);
  const CardFace = component.exports.default;
  const cards = [...new Map(createDeck().map(card => [`${card.fruit}-${card.count}`, card])).values()];
  const fruits = { strawberry: ['딸기', '개'], banana: ['바나나', '개'], plum: ['포도', '송이'], lemon: ['레몬', '개'] };
  assert.equal(cards.length, 20);

  for (const card of cards) {
    const html = renderToStaticMarkup(React.createElement(CardFace, card));
    const images = html.match(/<img\b[^>]*>/g) || [];
    const [label, unit] = fruits[card.fruit];
    const context = `${card.fruit} ${card.count}`;
    assert.equal(images.length, card.count, context);
    assert.equal((html.match(/role="img"/g) || []).length, 1, context);
    assert.ok(html.includes(`aria-label="${label} ${card.count}${unit}"`), context);
    assert.ok(html.includes(`data-fruit="${card.fruit}"`) && html.includes(`data-count="${card.count}"`), context);
    const sources = images.map(image => /src="([^"]+)"/.exec(image)?.[1]);
    assert.equal(new Set(sources).size, 1, context);
    assert.equal(sources[0], `/public/brand/fruits/${card.fruit}.png`, context);
    for (const image of images) {
      assert.match(image, /class="card-fruit"/, context);
      assert.match(image, /alt=""/, context);
      assert.match(image, /aria-hidden="true"/, context);
      assert.match(image, /src="[^"?]+\.png"/, context);
    }
  }
});
